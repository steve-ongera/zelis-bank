from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction as db_transaction
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Account, Transaction
from .permissions import IsActiveAccount
from .serializers import (
    RegisterSerializer,
    CustomTokenObtainPairSerializer,
    ProfileSerializer,
    ChangePasswordSerializer,
    TransactionSerializer,
    SendMoneySerializer,
    DepositSerializer,
    DashboardSummarySerializer,
    PendingAccountSerializer,
    VerifyAccountSerializer,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register/ — public. Creates a pending account."""

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class CustomTokenObtainPairView(TokenObtainPairView):
    """POST /api/auth/login/ — public. Blocks non-active accounts."""

    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    """POST /api/auth/logout/ — blacklists the refresh token."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            return Response(
                {"detail": "Invalid or already-expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"detail": "Logged out successfully."}, status=status.HTTP_205_RESET_CONTENT)


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

class ProfileView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/profile/"""

    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """POST /api/profile/change-password/"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()
        return Response({"detail": "Password updated successfully."})


# ---------------------------------------------------------------------------
# Account lookup — the real-time recipient preview
# ---------------------------------------------------------------------------

class AccountLookupView(APIView):
    """
    GET /api/accounts/lookup/?account_number=2200145821

    Returns a masked account holder name if (and only if) the account
    exists AND is active. Never reveals *why* a lookup failed (doesn't
    distinguish "doesn't exist" from "exists but inactive") to avoid
    account enumeration.
    """

    permission_classes = [permissions.IsAuthenticated, IsActiveAccount]

    def get(self, request):
        account_number = request.query_params.get("account_number", "").strip()
        if not account_number:
            return Response(
                {"detail": "account_number query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if account_number == request.user.account.account_number:
            return Response(
                {"exists": False, "account_holder": None, "detail": "Cannot send to your own account."}
            )

        account = Account.objects.filter(
            account_number=account_number, status=Account.STATUS_ACTIVE
        ).first()

        if not account:
            return Response({"exists": False, "account_holder": None, "account_number": account_number})

        return Response(
            {
                "exists": True,
                "account_holder": account.masked_holder_name,
                "account_number": account.account_number,
            }
        )


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

class TransactionListView(generics.ListAPIView):
    """GET /api/transactions/ — paginated history for the logged-in user."""

    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        account = self.request.user.account
        return Transaction.objects.filter(
            Q(sender_account=account) | Q(receiver_account=account)
        ).order_by("-created_at")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["account"] = self.request.user.account
        return context


class TransactionDetailView(generics.RetrieveAPIView):
    """GET /api/transactions/<id>/"""

    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "id"

    def get_queryset(self):
        account = self.request.user.account
        return Transaction.objects.filter(Q(sender_account=account) | Q(receiver_account=account))

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["account"] = self.request.user.account
        return context


class SendMoneyView(APIView):
    """
    POST /api/transactions/send/
    body: { "account_number": "...", "amount": "500.00", "narrative": "rent" }

    Wrapped in a DB transaction with row-level locking on both accounts to
    prevent race conditions (e.g. double-spend from two simultaneous requests).
    """

    permission_classes = [permissions.IsAuthenticated, IsActiveAccount]

    def post(self, request):
        serializer = SendMoneySerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with db_transaction.atomic():
            sender_account = Account.objects.select_for_update().get(user=request.user)
            receiver_account = Account.objects.select_for_update().get(
                account_number=data["account_number"]
            )

            # Re-validate inside the lock — balance may have changed since serializer validation.
            if data["amount"] > sender_account.balance:
                return Response(
                    {"detail": "Insufficient balance."}, status=status.HTTP_400_BAD_REQUEST
                )

            sender_account.balance -= data["amount"]
            receiver_account.balance += data["amount"]
            sender_account.save(update_fields=["balance", "updated_at"])
            receiver_account.save(update_fields=["balance", "updated_at"])

            narrative = data.get("narrative", "") or "Money transfer"

            txn = Transaction.objects.create(
                transaction_type=Transaction.TYPE_TRANSFER,
                status=Transaction.STATUS_COMPLETED,
                sender_account=sender_account,
                receiver_account=receiver_account,
                amount=data["amount"],
                balance_after=sender_account.balance,
                narrative=narrative,
            )

        return Response(
            {
                "detail": f"KES {data['amount']} sent to {receiver_account.masked_holder_name}.",
                "transaction": TransactionSerializer(txn, context={"account": sender_account}).data,
                "new_balance": sender_account.balance,
            },
            status=status.HTTP_201_CREATED,
        )


class DepositView(APIView):
    """
    POST /api/transactions/deposit/
    Simulated self top-up for demo purposes (real implementation would hook
    into M-Pesa Daraja STK Push and only credit on a successful callback).
    """

    permission_classes = [permissions.IsAuthenticated, IsActiveAccount]

    def post(self, request):
        serializer = DepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with db_transaction.atomic():
            account = Account.objects.select_for_update().get(user=request.user)
            account.balance += data["amount"]
            account.save(update_fields=["balance", "updated_at"])

            txn = Transaction.objects.create(
                transaction_type=Transaction.TYPE_DEPOSIT,
                status=Transaction.STATUS_COMPLETED,
                sender_account=None,
                receiver_account=account,
                amount=data["amount"],
                balance_after=account.balance,
                narrative=data.get("narrative") or "Wallet top-up",
            )

        return Response(
            {
                "detail": f"KES {data['amount']} deposited successfully.",
                "transaction": TransactionSerializer(txn, context={"account": account}).data,
                "new_balance": account.balance,
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class DashboardSummaryView(APIView):
    """
    GET /api/dashboard/summary/

    Returns current balance, lifetime income/expense totals, a 14-day
    balance trend (for a line chart), a 6-month income vs expense
    breakdown (for a bar chart), and the 5 most recent transactions.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        account = request.user.account
        all_txns = Transaction.objects.filter(
            Q(sender_account=account) | Q(receiver_account=account)
        )

        total_income = all_txns.filter(receiver_account=account).aggregate(s=Sum("amount"))["s"] or 0
        total_expense = all_txns.filter(sender_account=account).aggregate(s=Sum("amount"))["s"] or 0

        # --- Balance trend: last 14 days, end-of-day balance snapshot ---
        balance_trend = []
        today = timezone.now().date()
        running_balance = account.balance
        # Walk backwards from today, subtracting each day's net movement to reconstruct history.
        daily_net = {}
        for txn in all_txns.filter(created_at__date__gte=today - timedelta(days=13)):
            day = txn.created_at.date()
            net = txn.amount if txn.receiver_account_id == account.id else -txn.amount
            daily_net[day] = daily_net.get(day, 0) + net

        cursor_balance = float(account.balance)
        trend_points = []
        for i in range(14):
            day = today - timedelta(days=i)
            trend_points.append({"date": day.isoformat(), "balance": round(cursor_balance, 2)})
            cursor_balance -= float(daily_net.get(day, 0))
        balance_trend = list(reversed(trend_points))

        # --- Income vs expense: last 6 months ---
        income_vs_expense = []
        for i in range(5, -1, -1):
            month_start = (today.replace(day=1) - timedelta(days=1)).replace(day=1) if i == 0 else None
            # simpler: compute month boundaries directly
            year = today.year
            month = today.month - i
            while month <= 0:
                month += 12
                year -= 1
            month_txns = all_txns.filter(created_at__year=year, created_at__month=month)
            income = month_txns.filter(receiver_account=account).aggregate(s=Sum("amount"))["s"] or 0
            expense = month_txns.filter(sender_account=account).aggregate(s=Sum("amount"))["s"] or 0
            income_vs_expense.append(
                {
                    "month": f"{year}-{month:02d}",
                    "income": float(income),
                    "expense": float(expense),
                }
            )

        recent = all_txns.order_by("-created_at")[:5]

        payload = {
            "balance": account.balance,
            "total_income": total_income,
            "total_expense": total_expense,
            "transaction_count": all_txns.count(),
            "balance_trend": balance_trend,
            "income_vs_expense": income_vs_expense,
            "recent_transactions": recent,
        }
        serializer = DashboardSummarySerializer(payload, context={"account": account})
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Admin verification endpoints
# ---------------------------------------------------------------------------

class PendingAccountsView(generics.ListAPIView):
    """GET /api/admin/accounts/pending/ — staff only."""

    serializer_class = PendingAccountSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = Account.objects.filter(status=Account.STATUS_PENDING).order_by("created_at")


class VerifyAccountView(APIView):
    """PATCH /api/admin/accounts/<id>/verify/ — staff only."""

    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk):
        try:
            account = Account.objects.get(pk=pk)
        except Account.DoesNotExist:
            return Response({"detail": "Account not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = VerifyAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data["action"]

        if action == "approve":
            account.status = Account.STATUS_ACTIVE
            account.rejection_reason = ""
        else:
            account.status = Account.STATUS_REJECTED
            account.rejection_reason = serializer.validated_data.get("rejection_reason", "")

        account.verified_by = request.user
        account.verified_at = timezone.now()
        account.save()

        return Response(PendingAccountSerializer(account).data)
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction as db_transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Account, Transaction

User = get_user_model()


# ---------------------------------------------------------------------------
# Auth / Registration
# ---------------------------------------------------------------------------

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    confirm_password = serializers.CharField(write_only=True, required=True)
    phone_number = serializers.CharField(write_only=True, required=True, max_length=15)
    id_number = serializers.CharField(write_only=True, required=True, max_length=20)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "confirm_password",
            "phone_number",
            "id_number",
        ]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        if Account.objects.filter(phone_number=attrs["phone_number"]).exists():
            raise serializers.ValidationError(
                {"phone_number": "This phone number is already registered."}
            )
        return attrs

    def create(self, validated_data):
        phone_number = validated_data.pop("phone_number")
        id_number = validated_data.pop("id_number")
        validated_data.pop("confirm_password")
        password = validated_data.pop("password")

        with db_transaction.atomic():
            user = User.objects.create_user(password=password, **validated_data)
            account = Account.objects.create(
                user=user,
                phone_number=phone_number,
                id_number=id_number,
                status=Account.STATUS_PENDING,
            )
        self._account = account
        return user

    def to_representation(self, instance):
        return {
            "username": instance.username,
            "email": instance.email,
            "account_number": self._account.account_number,
            "status": self._account.status,
            "message": "Registration successful. Your account is pending admin verification.",
        }


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default JWT serializer to:
    1. Block login entirely if the linked Account isn't 'active'.
    2. Embed useful claims (account_number, full_name, is_staff) directly
       in the access token, so the frontend doesn't need an extra /me call
       immediately after login.
    """

    def validate(self, attrs):
        data = super().validate(attrs)  # raises if credentials are wrong

        account = getattr(self.user, "account", None)
        if account is None:
            raise serializers.ValidationError(
                "No account is linked to this user. Contact support."
            )

        if account.status == Account.STATUS_PENDING:
            raise serializers.ValidationError(
                "Your account is still pending admin verification. Please check back soon."
            )
        if account.status == Account.STATUS_REJECTED:
            raise serializers.ValidationError(
                f"Your account verification was rejected: {account.rejection_reason or 'contact support.'}"
            )
        if account.status == Account.STATUS_SUSPENDED:
            raise serializers.ValidationError(
                "Your account has been suspended. Please contact support."
            )

        data["account_number"] = account.account_number
        data["full_name"] = self.user.get_full_name() or self.user.username
        data["is_staff"] = self.user.is_staff
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        account = getattr(user, "account", None)
        token["full_name"] = user.get_full_name() or user.username
        token["is_staff"] = user.is_staff
        if account:
            token["account_number"] = account.account_number
        return token


# ---------------------------------------------------------------------------
# Profile / Account
# ---------------------------------------------------------------------------

class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = [
            "account_number",
            "balance",
            "status",
            "phone_number",
            "created_at",
        ]
        read_only_fields = fields


class ProfileSerializer(serializers.ModelSerializer):
    account = AccountSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "account"]
        read_only_fields = ["id", "username", "account"]


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value


# ---------------------------------------------------------------------------
# Account lookup (the "real-time recipient preview" endpoint)
# ---------------------------------------------------------------------------

class AccountLookupSerializer(serializers.Serializer):
    account_number = serializers.CharField()
    exists = serializers.BooleanField()
    account_holder = serializers.CharField(allow_null=True)


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

class TransactionSerializer(serializers.ModelSerializer):
    direction = serializers.SerializerMethodField()
    counterparty = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            "id",
            "reference",
            "transaction_type",
            "status",
            "amount",
            "balance_after",
            "narrative",
            "direction",
            "counterparty",
            "created_at",
        ]
        read_only_fields = fields

    def get_direction(self, obj):
        request_account = self.context.get("account")
        if obj.transaction_type == Transaction.TYPE_DEPOSIT:
            return "credit"
        if request_account and obj.sender_account_id == request_account.id:
            return "debit"
        return "credit"

    def get_counterparty(self, obj):
        request_account = self.context.get("account")
        if obj.transaction_type == Transaction.TYPE_DEPOSIT:
            return "Self top-up"
        if request_account and obj.sender_account_id == request_account.id:
            target = obj.receiver_account
        else:
            target = obj.sender_account
        if not target:
            return "Unknown"
        return f"{target.masked_holder_name} ({target.account_number})"


class SendMoneySerializer(serializers.Serializer):
    account_number = serializers.CharField(max_length=10)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("1.00"))
    narrative = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_account_number(self, value):
        if not Account.objects.filter(account_number=value, status=Account.STATUS_ACTIVE).exists():
            raise serializers.ValidationError("Recipient account not found or inactive.")
        return value

    def validate(self, attrs):
        request = self.context["request"]
        sender_account = request.user.account
        if attrs["account_number"] == sender_account.account_number:
            raise serializers.ValidationError("You cannot send money to your own account.")
        if attrs["amount"] > sender_account.balance:
            raise serializers.ValidationError("Insufficient balance.")
        return attrs


class DepositSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("1.00"))
    narrative = serializers.CharField(max_length=255, required=False, allow_blank=True)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class DashboardSummarySerializer(serializers.Serializer):
    balance = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_income = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_expense = serializers.DecimalField(max_digits=14, decimal_places=2)
    transaction_count = serializers.IntegerField()
    balance_trend = serializers.ListField(child=serializers.DictField())
    income_vs_expense = serializers.ListField(child=serializers.DictField())
    recent_transactions = TransactionSerializer(many=True)


# ---------------------------------------------------------------------------
# Admin verification
# ---------------------------------------------------------------------------

class PendingAccountSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = [
            "id",
            "username",
            "email",
            "full_name",
            "account_number",
            "phone_number",
            "id_number",
            "status",
            "created_at",
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class VerifyAccountSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])
    rejection_reason = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate(self, attrs):
        if attrs["action"] == "reject" and not attrs.get("rejection_reason"):
            raise serializers.ValidationError(
                {"rejection_reason": "A reason is required when rejecting an account."}
            )
        return attrs
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterView,
    CustomTokenObtainPairView,
    LogoutView,
    ProfileView,
    ChangePasswordView,
    AccountLookupView,
    TransactionListView,
    TransactionDetailView,
    SendMoneyView,
    DepositView,
    DashboardSummaryView,
    PendingAccountsView,
    VerifyAccountView,
)

urlpatterns = [
    # --- Auth ---
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),

    # --- Profile ---
    path("profile/", ProfileView.as_view(), name="profile"),
    path("profile/change-password/", ChangePasswordView.as_view(), name="change_password"),

    # --- Account lookup (real-time recipient preview) ---
    path("accounts/lookup/", AccountLookupView.as_view(), name="account_lookup"),

    # --- Transactions ---
    path("transactions/", TransactionListView.as_view(), name="transaction_list"),
    path("transactions/<int:id>/", TransactionDetailView.as_view(), name="transaction_detail"),
    path("transactions/send/", SendMoneyView.as_view(), name="send_money"),
    path("transactions/deposit/", DepositView.as_view(), name="deposit"),

    # --- Dashboard ---
    path("dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard_summary"),

    # --- Admin verification ---
    path("admin/accounts/pending/", PendingAccountsView.as_view(), name="pending_accounts"),
    path("admin/accounts/<int:pk>/verify/", VerifyAccountView.as_view(), name="verify_account"),
]
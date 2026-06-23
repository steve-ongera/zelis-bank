from rest_framework.permissions import BasePermission

from .models import Account


class IsActiveAccount(BasePermission):
    """
    Allows access only to authenticated users whose linked Account has
    status == 'active'. Used on every money-movement endpoint as a second
    line of defense, even though login already blocks non-active accounts —
    this guards against a still-valid access token being used after an
    account gets suspended mid-session.
    """

    message = "Your account is not active. Contact support."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        account = getattr(request.user, "account", None)
        return bool(account and account.status == Account.STATUS_ACTIVE)
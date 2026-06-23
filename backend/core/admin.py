from django.contrib import admin

from .models import Account, Transaction


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ["account_number", "user", "status", "balance", "phone_number", "created_at"]
    list_filter = ["status"]
    search_fields = ["account_number", "user__username", "user__email", "phone_number", "id_number"]
    readonly_fields = ["account_number", "created_at", "updated_at"]
    actions = ["approve_accounts", "reject_accounts"]

    @admin.action(description="Approve selected accounts")
    def approve_accounts(self, request, queryset):
        updated = queryset.update(status=Account.STATUS_ACTIVE, verified_by=request.user)
        self.message_user(request, f"{updated} account(s) approved.")

    @admin.action(description="Reject selected accounts")
    def reject_accounts(self, request, queryset):
        updated = queryset.update(status=Account.STATUS_REJECTED, verified_by=request.user)
        self.message_user(request, f"{updated} account(s) rejected.")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = [
        "reference",
        "transaction_type",
        "status",
        "amount",
        "sender_account",
        "receiver_account",
        "created_at",
    ]
    list_filter = ["transaction_type", "status"]
    search_fields = ["reference", "sender_account__account_number", "receiver_account__account_number"]
    readonly_fields = [f.name for f in Transaction._meta.fields]
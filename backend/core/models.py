import random
import string
import uuid

from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator


def generate_account_number():
    """
    Generates a unique 10-digit Zelis Bank account number.
    Format: 22 (bank prefix) + 8 random digits.
    Collisions are checked against the DB before returning.
    """
    while True:
        number = "22" + "".join(random.choices(string.digits, k=8))
        if not Account.objects.filter(account_number=number).exists():
            return number


class Account(models.Model):
    """
    1:1 extension of the auth User.
    Holds the KES balance, account number, and verification status.
    A user CANNOT send/deposit money until status == 'active'.
    """

    STATUS_PENDING = "pending"
    STATUS_ACTIVE = "active"
    STATUS_REJECTED = "rejected"
    STATUS_SUSPENDED = "suspended"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending Verification"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_SUSPENDED, "Suspended"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="account"
    )
    account_number = models.CharField(
        max_length=10, unique=True, default=generate_account_number, editable=False
    )
    balance = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    status = models.CharField(
        max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING
    )

    # KYC fields captured at registration, reviewed by admin before verification
    id_number = models.CharField(max_length=20, blank=True)
    phone_number = models.CharField(max_length=15)

    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accounts_verified",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.account_number} ({self.user.username})"

    @property
    def is_active_account(self):
        return self.status == self.STATUS_ACTIVE

    @property
    def masked_holder_name(self):
        """e.g. 'John Mwangi' -> 'J*** M***' — used for the send-money lookup preview."""
        full_name = self.user.get_full_name() or self.user.username
        parts = full_name.strip().split()
        masked_parts = [f"{p[0].upper()}{'*' * max(len(p) - 1, 1)}" for p in parts if p]
        return " ".join(masked_parts) if masked_parts else "Unknown"


class Transaction(models.Model):
    """
    Immutable ledger row. Every balance-affecting action creates exactly one
    of these. Sender/receiver are nullable independently because deposits
    have no sender (external funding) and some future txn types may have
    no receiver (e.g. withdrawal/fees).
    """

    TYPE_DEPOSIT = "deposit"
    TYPE_TRANSFER = "transfer"
    TYPE_WITHDRAWAL = "withdrawal"

    TYPE_CHOICES = [
        (TYPE_DEPOSIT, "Deposit"),
        (TYPE_TRANSFER, "Transfer"),
        (TYPE_WITHDRAWAL, "Withdrawal"),
    ]

    STATUS_PENDING = "pending"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]

    reference = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    transaction_type = models.CharField(max_length=12, choices=TYPE_CHOICES)
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default=STATUS_COMPLETED
    )

    sender_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_transactions",
    )
    receiver_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_transactions",
    )

    amount = models.DecimalField(max_digits=14, decimal_places=2)
    balance_after = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        help_text="Balance of the account this row belongs to, right after this transaction.",
    )
    narrative = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["sender_account", "-created_at"]),
            models.Index(fields=["receiver_account", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.transaction_type} - KES {self.amount} ({self.reference})"
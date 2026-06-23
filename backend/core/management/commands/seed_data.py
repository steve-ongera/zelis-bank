import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction as db_transaction
from django.utils import timezone

from core.models import Account, Transaction

User = get_user_model()

# (first_name, last_name, username, phone, id_number)
DEMO_PEOPLE = [
    ("John", "Mwangi", "jmwangi", "0712345671", "30112201"),
    ("Alice", "Kamau", "akamau", "0712345672", "30112202"),
    ("Brian", "Otieno", "botieno", "0712345673", "30112203"),
    ("Grace", "Wanjiru", "gwanjiru", "0712345674", "30112204"),
    ("Kevin", "Kiprotich", "kkiprotich", "0712345675", "30112205"),
    ("Faith", "Achieng", "fachieng", "0712345676", "30112206"),
    ("Samuel", "Mutua", "smutua", "0712345677", "30112207"),
    ("Mercy", "Njeri", "mnjeri", "0712345678", "30112208"),
]

# These two are created with status='pending' so the admin verification
# queue (/api/admin/accounts/pending/) has something to show.
PENDING_PEOPLE = [
    ("Dennis", "Omondi", "domondi", "0712345679", "30112209"),
    ("Lucy", "Chebet", "lchebet", "0712345680", "30112210"),
]

DEFAULT_PASSWORD = "Password123"
NARRATIVES = [
    "Rent payment", "School fees", "Lunch money", "Shopping", "Salary top-up",
    "Electricity bill", "Fuel", "Airtime", "Savings", "Loan repayment",
    "Family support", "Business stock", "Water bill", "Internet bill",
]


class Command(BaseCommand):
    help = (
        "Seeds Zelis Bank with demo users, accounts (active + pending), and a "
        "realistic transaction history spanning the last ~6 months — enough "
        "data for the dashboard charts (balance trend, income vs expense) to "
        "render meaningfully and for the admin verification queue to have "
        "pending accounts to review."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete all existing demo data (accounts/transactions/users created "
                 "by this command) before reseeding.",
        )
        parser.add_argument(
            "--transactions-per-user",
            type=int,
            default=15,
            help="Roughly how many transactions to generate per active user (default: 15).",
        )

    def handle(self, *args, **options):
        if options["flush"]:
            self._flush()

        with db_transaction.atomic():
            active_accounts = self._create_people(DEMO_PEOPLE, status=Account.STATUS_ACTIVE)
            self._create_people(PENDING_PEOPLE, status=Account.STATUS_PENDING)
            self._fund_accounts(active_accounts)
            self._generate_transactions(active_accounts, options["transactions_per_user"])

        self.stdout.write(self.style.SUCCESS(
            f"\nSeed complete: {len(active_accounts)} active accounts, "
            f"{len(PENDING_PEOPLE)} pending accounts.\n"
            f"All demo users share the password: {DEFAULT_PASSWORD}\n"
            f"Try logging in as: {DEMO_PEOPLE[0][2]} / {DEFAULT_PASSWORD}"
        ))

    # ------------------------------------------------------------------
    # Steps
    # ------------------------------------------------------------------

    def _flush(self):
        usernames = [p[2] for p in DEMO_PEOPLE + PENDING_PEOPLE]
        deleted_users, _ = User.objects.filter(username__in=usernames).delete()
        self.stdout.write(self.style.WARNING(f"Flushed {deleted_users} demo user(s) and related data."))

    def _create_people(self, people, status):
        accounts = []
        for first, last, username, phone, id_number in people:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": first,
                    "last_name": last,
                    "email": f"{username}@example.com",
                },
            )
            if created:
                user.set_password(DEFAULT_PASSWORD)
                user.save()

            account, _ = Account.objects.get_or_create(
                user=user,
                defaults={"phone_number": phone, "id_number": id_number, "status": status},
            )
            # Ensure status/phone/id stay correct even if the account already existed
            account.status = status
            account.phone_number = phone
            account.id_number = id_number
            if status == Account.STATUS_ACTIVE:
                account.verified_at = timezone.now()
            account.save()

            verb = "Created" if created else "Reused"
            self.stdout.write(f"{verb} {status} account: {username} -> {account.account_number}")

            if status == Account.STATUS_ACTIVE:
                accounts.append(account)
        return accounts

    def _fund_accounts(self, accounts):
        """Give every active account a starting deposit so they have something to send."""
        for account in accounts:
            if account.balance > 0:
                continue  # already funded from a previous run
            opening_amount = random.choice([10000, 15000, 20000, 25000, 30000])
            account.balance = opening_amount
            account.save(update_fields=["balance"])
            Transaction.objects.create(
                transaction_type=Transaction.TYPE_DEPOSIT,
                status=Transaction.STATUS_COMPLETED,
                sender_account=None,
                receiver_account=account,
                amount=opening_amount,
                balance_after=opening_amount,
                narrative="Opening balance",
                created_at=timezone.now() - timedelta(days=180),
            )

    def _generate_transactions(self, accounts, per_user):
        """
        Spreads random transfers between active accounts and occasional
        self-deposits across the last 180 days, replaying each account's
        running balance forward so balance_after stays accurate and no
        account ever goes negative.
        """
        if len(accounts) < 2:
            self.stdout.write(self.style.WARNING(
                "Need at least 2 active accounts to generate transfers — skipping."
            ))
            return

        running_balance = {acc.id: acc.balance for acc in accounts}
        total_created = 0

        for account in accounts:
            for _ in range(per_user):
                days_ago = random.randint(1, 179)
                created_at = timezone.now() - timedelta(
                    days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59)
                )

                # ~30% chance of a self-deposit, ~70% chance of sending to a peer
                if random.random() < 0.3 or len(accounts) < 2:
                    amount = random.choice([1000, 2000, 3000, 5000, 7500, 10000])
                    running_balance[account.id] += amount
                    Transaction.objects.create(
                        transaction_type=Transaction.TYPE_DEPOSIT,
                        status=Transaction.STATUS_COMPLETED,
                        sender_account=None,
                        receiver_account=account,
                        amount=amount,
                        balance_after=running_balance[account.id],
                        narrative=random.choice(["Salary", "Wallet top-up", "M-Pesa deposit"]),
                        created_at=created_at,
                    )
                    total_created += 1
                else:
                    receiver = random.choice([a for a in accounts if a.id != account.id])
                    max_sendable = running_balance[account.id]
                    if max_sendable < 100:
                        continue  # avoid overdraft in the simulated history

                    amount = min(random.choice([200, 500, 1000, 1500, 2500, 4000]), max_sendable)
                    running_balance[account.id] -= amount
                    running_balance[receiver.id] += amount

                    Transaction.objects.create(
                        transaction_type=Transaction.TYPE_TRANSFER,
                        status=Transaction.STATUS_COMPLETED,
                        sender_account=account,
                        receiver_account=receiver,
                        amount=amount,
                        balance_after=running_balance[account.id],
                        narrative=random.choice(NARRATIVES),
                        created_at=created_at,
                    )
                    total_created += 1

        # Persist final balances back onto the actual Account rows
        for account in accounts:
            account.balance = running_balance[account.id]
            account.save(update_fields=["balance"])

        self.stdout.write(self.style.SUCCESS(f"Generated {total_created} transactions."))
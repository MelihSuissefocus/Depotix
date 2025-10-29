"""
Management Command: cleanup_old_sessions_logs
Cleans up expired Django sessions and optionally truncates large log files.
"""
from django.core.management.base import BaseCommand
from django.core import management
import subprocess
import os


class Command(BaseCommand):
    help = "Cleans expired Django sessions; optionally truncates large log files"

    def add_arguments(self, parser):
        parser.add_argument(
            '--rotate-logs',
            action='store_true',
            default=False,
            help='Truncate log files larger than 10MB (default: False)'
        )
        parser.add_argument(
            '--log-size-mb',
            type=int,
            default=10,
            help='Log size threshold in MB for rotation (default: 10)'
        )

    def handle(self, *args, **options):
        rotate_logs = options['rotate_logs']
        log_size_mb = options['log_size_mb']

        # 1. Clean expired Django sessions
        self.stdout.write("[INFO] Running Django session cleanup...")
        try:
            management.call_command('clearsessions', verbosity=0)
            self.stdout.write(self.style.SUCCESS("✅ Expired sessions cleaned"))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"❌ Session cleanup failed: {e}"))
            return

        # 2. Optional: Truncate large log files
        if rotate_logs:
            self.stdout.write(f"[INFO] Rotating log files larger than {log_size_mb}MB...")

            # Find log files in /app directory (container path)
            log_dir = '/app'
            if os.path.exists(log_dir):
                try:
                    # Safe command: find logs > size, truncate them
                    find_cmd = (
                        f"find {log_dir} -maxdepth 2 -type f -name '*.log' "
                        f"-size +{log_size_mb}M -exec truncate -s 0 {{}} \\; -print"
                    )

                    result = subprocess.run(
                        ['sh', '-c', find_cmd],
                        capture_output=True,
                        text=True,
                        check=False
                    )

                    if result.returncode == 0:
                        rotated_files = [f for f in result.stdout.strip().split('\n') if f]
                        if rotated_files:
                            self.stdout.write(self.style.SUCCESS(
                                f"✅ Rotated {len(rotated_files)} log file(s):"
                            ))
                            for log_file in rotated_files:
                                self.stdout.write(f"   - {log_file}")
                        else:
                            self.stdout.write("[INFO] No large log files found")
                    else:
                        self.stderr.write(self.style.WARNING(
                            f"⚠️  Log rotation completed with warnings: {result.stderr}"
                        ))

                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"❌ Log rotation failed: {e}"))
            else:
                self.stdout.write(self.style.WARNING(
                    f"⚠️  Log directory not found: {log_dir}"
                ))

        self.stdout.write(self.style.SUCCESS("\n✅ Cleanup complete"))

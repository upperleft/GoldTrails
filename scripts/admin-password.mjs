// Interactive helper; never takes a password on the command line or prints it.
import { hashPassword } from '../app/admin-auth.js';
if (!process.stdin.isTTY) throw new Error('Run this helper in your own Terminal');
process.stdout.write('Choose your Gold Trails administrator password (15–128 characters): ');
process.stdin.setRawMode(true); process.stdin.resume();
let password = '';
process.stdin.on('data', async data => {
  const text = data.toString();
  if (text.includes('\u0003')) { process.stdin.setRawMode(false); process.exit(1); }
  if (text.includes('\r') || text.includes('\n')) {
    process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeAllListeners('data'); process.stdout.write('\n');
    try { const hash = await hashPassword(password); password=''; console.log('ADMIN_PASSWORD_HASH value (store privately in Hostinger, never in Git):\n'+hash); }
    catch { console.error('Use a password of 15–128 characters. Run the helper again.'); process.exitCode=1; }
  } else for (const char of text) { if (char === '\u007f' || char === '\b') password=password.slice(0,-1); else if (char >= ' ' && password.length < 129) password+=char; }
});

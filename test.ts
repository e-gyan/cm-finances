import * as crypto from 'crypto';
console.log(crypto.createHash('sha256').update('12345').digest('hex'));
console.log(crypto.createHash('sha256').update('FINANCE123').digest('hex'));

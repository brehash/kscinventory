// WooCommerce order sync script for scheduled execution

import { wooSyncScript } from './wooCommerceSync.ts';

console.log('Running WooCommerce sync script...');

wooSyncScript()
  .then(() => {
    console.log('WooCommerce sync completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error running WooCommerce sync:', error);
    process.exit(1);
  });
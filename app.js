import ShopifyClient from './shopifyClient.js';

const client = new ShopifyClient();

// const p = await client.fetchPayoutsByDate('2025-07-23');
// console.log(p);
const order = await client.getOrderById('gid://shopify/Order/6068721909896');
console.log(order);
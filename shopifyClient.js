import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

class ShopifyClient {
    constructor() {
        this.store = process.env.SHOPIFY_STORE;
        this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
        this.graphqlUrl = `https://${this.store}.myshopify.com/admin/api/2024-07/graphql.json`;
    }

    async executeQuery(query, variables = {}) {
        try {
            const response = await axios.post(this.graphqlUrl,
                { query, variables },
                {
                    headers: {
                        'X-Shopify-Access-Token': this.accessToken,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`GraphQL query failed: ${error.response?.data || error.message}`);
        }
    }

    getYesterdayDate() {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    }

    async fetchPayoutsByDate(date) {
        let hasNextPage = true;
        let endCursor = null;
        const allPayouts = [];

        while (hasNextPage) {
            const query = `
                query($cursor: String) {
                    shopifyPaymentsAccount {
                        balanceTransactions(first: 10, after: $cursor, query: "payout_date:${date}") {
                            nodes {
                                id
                                type
                                test
                                transactionDate
                                associatedPayout {
                                    id
                                    status
                                }
                                amount {
                                    amount
                                    currencyCode
                                }
                                fee {
                                    amount
                                }
                                net {
                                    amount
                                }
                                sourceId
                                sourceType
                                sourceOrderTransactionId
                                associatedOrder {
                                    id
                                }
                            }
                            pageInfo {
                                hasNextPage
                                endCursor
                            }
                        }
                    }
                }`;

            const response = await this.executeQuery(query, { cursor: endCursor });
            const data = response.data.shopifyPaymentsAccount.balanceTransactions;

            const filteredNodes = data.nodes.filter(payout =>
                !(payout.type === 'TRANSFER' && payout.sourceType === 'TRANSFER')
            );

            allPayouts.push(...filteredNodes);
            hasNextPage = data.pageInfo.hasNextPage;
            endCursor = data.pageInfo.endCursor;
        }

        return allPayouts;
    }

    async getOrderById(orderId) {
        const query = `
            query($id: ID!) {
                order(id: $id) {
                    id
                    name
                    totalPrice
                    createdAt
                    displayFinancialStatus
                    displayFulfillmentStatus
                }
            }`;

        const response = await this.executeQuery(query, { id: orderId });
        return response.data.order;
    }

    async savePayoutsToCSV(payouts, date) {
        const csvData = payouts.map(payout => ({
            type: payout.type,
            transactionDate: payout.transactionDate,
            amount: payout.amount.amount,
            currency: payout.amount.currencyCode,
            fee: payout.fee.amount,
            net: payout.net.amount
        }));

        const csvContent = [
            ["Type", "Transaction Date", "Amount", "Currency", "Fee", "Net"],
            ...csvData.map(row => Object.values(row))
        ].map(e => e.join(",")).join("\n");

        fs.writeFileSync(`shopify_payouts_${date}.csv`, csvContent);
        return `shopify_payouts_${date}.csv`;
    }
}

export default ShopifyClient;
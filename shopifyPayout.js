import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const GRAPHQL_URL = `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-07/graphql.json`;

//should be in the format YYYY-MM-DD
//e.g. 2023-10-01
//this will be used to fetch payouts for the previous day
//if you want to fetch payouts for today, you can use getTodayDate() function
const getYesterdayDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
};

const fetchPayoutsByDate = async (date) => {
    let hasNextPage = true;
    let endCursor = null;
    const allPayouts = [];
    //associatedPayout:status:PAID
    while (hasNextPage) {
        const query = `
            query {
                shopifyPaymentsAccount {
                    balanceTransactions(first: 10, after: ${endCursor ? `"${endCursor}"` : null}, query: "payout_date:${date}") {
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
                            adjustmentsOrders {
                                orderTransactionId
                                amount {
                                    amount
                                }
                                name
                            }
                            adjustmentReason
                        }
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                    }
                }
            }`;

        try {
            const response = await axios.post(GRAPHQL_URL, { query }, {
                headers: {
                    'X-Shopify-Access-Token': ACCESS_TOKEN,
                    'Content-Type': 'application/json'
                }
            });

            const data = response.data.data.shopifyPaymentsAccount.balanceTransactions;
            //do not include if the type is TRANSFER and source_type2 is TRANSFER
            const filteredNodes = data.nodes.filter(payout => !(payout.type === 'TRANSFER' && payout.sourceType === 'TRANSFER'));

            allPayouts.push(...filteredNodes);

            hasNextPage = data.pageInfo.hasNextPage;
            endCursor = data.pageInfo.endCursor;

        } catch (error) {
            console.error("Error fetching payouts:", error.response?.data || error.message);
            break;
        }
    }

    return allPayouts;
};
// Function to save payouts to a CSV file
//pass payouts array and date in YYYY-MM-DD format
//the date will be used to name the file
//e.g. if date is 2023-10-01, the file will be named shopify_payouts_2023-10-01.csv
const savePayoutsToCSV = async (payouts, date) => {
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
    console.log(`Payouts saved to shopify_payouts_${date}.csv`);
};

fetchPayoutsByDate(getYesterdayDate()).then(async payouts => {
    //console.log("Payouts for yesterday:", payouts);
    await savePayoutsToCSV(payouts, getYesterdayDate());
}).catch(error => {
    console.error("Error in fetching payouts:", error);
});
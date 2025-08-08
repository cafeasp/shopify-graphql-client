using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using CsvHelper;
using CsvHelper.Configuration;
using System.Globalization;

public class ShopifyClient
{
    private readonly string store;
    private readonly string accessToken;
    private readonly string graphqlUrl;
    private readonly HttpClient httpClient;

    public ShopifyClient(string store, string accessToken)
    {
        this.store = store;
        this.accessToken = accessToken;
        graphqlUrl = $"https://{store}.myshopify.com/admin/api/2024-07/graphql.json";

        httpClient = new HttpClient();
        httpClient.DefaultRequestHeaders.Add("X-Shopify-Access-Token", accessToken);

    }

    public async Task<JsonDocument> ExecuteQueryAsync(string query, object variables = null)
    {
        var payload = JsonSerializer.Serialize(new { query, variables });
        var content = new StringContent(payload, Encoding.UTF8, "application/json");

        var response = await httpClient.PostAsync(graphqlUrl, content);
        var responseBody = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new Exception($"GraphQL query failed: {responseBody}");
        }

        return JsonDocument.Parse(responseBody);
    }

    public string GetYesterdayDate()
    {
        return DateTime.UtcNow.AddDays(-1).ToString("yyyy-MM-dd");
    }

    public async Task<List<PayoutRecord>> FetchPayoutsByDateAsync(string date)
    {
        bool hasNextPage = true;
        string endCursor = null;
        var allPayouts = new List<PayoutRecord>();

        while (hasNextPage)
        {
            string query = @"
                query($cursor: String) {
                    shopifyPaymentsAccount {
                        balanceTransactions(first: 10, after: $cursor, query: ""payout_date:" + date + @""") {
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
                }";

            var response = await ExecuteQueryAsync(query, new { cursor = endCursor });
            var root = response.RootElement.GetProperty("data")
                .GetProperty("shopifyPaymentsAccount")
                .GetProperty("balanceTransactions");

            var nodes = root.GetProperty("nodes");
            foreach (var payout in nodes.EnumerateArray())
            {
                string type = payout.GetProperty("type").GetString();
                string sourceType = payout.GetProperty("sourceType").GetString();

                if (type == "TRANSFER" && sourceType == "TRANSFER") continue;

                allPayouts.Add(new PayoutRecord
                {
                    Type = type,
                    TransactionDate = payout.GetProperty("transactionDate").GetString(),
                    Amount = payout.GetProperty("amount").GetProperty("amount").GetString(),
                    Currency = payout.GetProperty("amount").GetProperty("currencyCode").GetString(),
                    Fee = payout.GetProperty("fee").GetProperty("amount").GetString(),
                    Net = payout.GetProperty("net").GetProperty("amount").GetString()
                });
            }

            hasNextPage = root.GetProperty("pageInfo").GetProperty("hasNextPage").GetBoolean();
            endCursor = root.GetProperty("pageInfo").GetProperty("endCursor").GetString();
        }

        return allPayouts;
    }

    public async Task<OrderResult> GetOrderByIdAsync(string orderId)
    {
        string query = @"
            query($id: ID!) {
                order(id: $id) {
                    id
                    name
                    totalPrice
                    createdAt
                    displayFinancialStatus
                    displayFulfillmentStatus
                }
            }";

        var response = await ExecuteQueryAsync(query, new { id = orderId });
        var order = response.RootElement.GetProperty("data").GetProperty("order");

        return JsonSerializer.Deserialize<OrderResult>(order.ToString());
    }

    public string SavePayoutsToCSV(List<PayoutRecord> payouts, string date)
    {
        string filePath = $"shopify_payouts_{date}.csv";

        using var writer = new StreamWriter(filePath);
        using var csv = new CsvWriter(writer, new CsvConfiguration(CultureInfo.InvariantCulture));
        csv.WriteRecords(payouts);

        return filePath;
    }
}

public class PayoutRecord
{
    public string? Type { get; set; }
    public string? TransactionDate { get; set; }
    public string? Amount { get; set; }
    public string? Currency { get; set; }
    public string? Fee { get; set; }
    public string? Net { get; set; }
}

public class OrderResult
{
    public string? Id { get; set; }
    public string? Name { get; set; }
    public string? TotalPrice { get; set; }
    public string? CreatedAt { get; set; }
    public string? DisplayFinancialStatus { get; set; }
    public string? DisplayFulfillmentStatus { get; set; }
}

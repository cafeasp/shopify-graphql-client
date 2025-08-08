using Microsoft.Extensions.Configuration;

var config = new ConfigurationBuilder()
    .AddJsonFile("appsettings.json")
    .Build();

var store = config["Shopify:Store"];
var token = config["Shopify:AccessToken"];

var shopify = new ShopifyClient(store, token);
var date = shopify.GetYesterdayDate();
var payouts = await shopify.FetchPayoutsByDateAsync(date);
var filePath = shopify.SavePayoutsToCSV(payouts, date);
Console.WriteLine($"CSV saved: {filePath}");

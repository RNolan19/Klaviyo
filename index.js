require('dotenv').config()
// set up variables
const fetch = require('node-fetch')
const timestamp = require('unix-timestamp')
const Shopify = require('shopify-api-node')

// instantiate the Shopify store API
const shopify = new Shopify({
  shopName: process.env.SHOPNAME,
  apiKey: process.env.APIKEY,
  password: process.env.PASSWORD
})

// created a function to pull the orders from Shopify and then to iterate over each item, and then sending the data to Klaviyo for placedOrder and OrderedProduct
async function runKlaviyoChallenge () {
  pullShopifyOrders()
    .then((items) => {
      items.forEach(async (item) => {
        await orderedProduct(item)
        await placedOrder(item)
      })
    })
    .catch((error) => console.log(`error: ${error}`))
}
// this function starts all functionality needed to complete the Klaviyo challenge
runKlaviyoChallenge()

// The orderedProduct function sets out to iterate over order.line_items and post the payload to Klaviyo's tracking API, with a success getting a response of 1 and a failure getting a response of 0
// In an effort to be as thorough as possible, when available, I used the properties, property names, naming conventions and order provided in the URL below
// https://help.klaviyo.com/hc/en-us/articles/115005082927#ordered-product8
async function orderedProduct (orders) {
  orders.line_items.forEach(async (item) => {
    const payload = {
      token: process.env.TOKEN,
      event: 'Ordered Product',
      // relevant customer information
      customer_properties: {
        $email: orders.email,
        $first_name: orders.customer.first_name || 'Not Provided',
        $last_name: orders.customer.last_name || 'Not Provided'
      },
      properties: {
        $event_id: item.id,
        $value: item.price,
        Product_id: item.product_id,
        sku: item.sku || 'Not Provided',
        ProductName: item.name,
        Quantity: item.quantity,
        ProductCategories: item.properties
      },
      // Per requirements, used the UNIX timestamp
      time: timestamp.fromDate(orders.processed_at)
    }
    // sending out the data and awaiting a response to log out success or failure
    let res = await sendData(payload)
    console.log(res)
  })
}
// In an effort to be as thorough as possible, when available, I used the properties, property names, naming conventions and order provided in the URL below
// https://help.klaviyo.com/hc/en-us/articles/115005082927#server-side-metrics6

// The placedOrder function sets out to post the payload to Klaviyo's tracking API, with a success getting a response of 1 and a failure getting a response of 0
async function placedOrder (orders) {
  const payload = {
    token: process.env.TOKEN,
    event: 'Placed Order',
    customer_properties: {
      $email: orders.email,
      $first_name: orders.customer.first_name || 'Not Provided',
      $last_name: orders.customer.last_name || 'Not Provided',
      $phone_number: orders.customer.phone || 'Not Provided'
    },
    properties: {
      $event_id: orders.id,
      $value: orders.total_price,
      Categories: [].concat(...orders.line_items.map((item) => item.properties)),
      ItemNames: orders.line_items.map(item => item.name),
      DiscountCode: (orders.discount_codes.length) ? (orders.discount_codes.map(item => item.code)).toString() : 'Not Provided',
      DiscountValue: orders.total_discounts
    },
    Items: orders.line_items.map((item) => ({
      ProductID: item.id,
      sku: item.sku || 'No SKU provided',
      ProductName: item.name,
      Quantity: item.quantity,
      ItemPrice: item.price,
      RowTotal: '$' + (item.price * item.quantity),
      Categories: item.properties
    })),
    time: timestamp.fromDate(orders.processed_at)
  }
  let res = await sendData(payload)
  console.log(res)
}

// sending out the data and awaiting a response to log out success or failure
async function sendData (data) {
  const base64 = base64Encode(data)
  return fetch(`https://a.klaviyo.com/api/track?data=${base64}`)
    .then(res => res.json())
    .catch((error) => console.log(`error: ${error}`))
};

// per requirements, developed a utility function to encode any data object into base64
function base64Encode (data) {
  let dataStr = JSON.stringify(data)
  return Buffer.from(dataStr).toString('base64')
}
// this function utilizies the Shopify API methods to get a list of orders
async function pullShopifyOrders () {
  return shopify.order
    .list()
    .catch((err) => console.error(err))
}

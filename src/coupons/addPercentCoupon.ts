import { APIGatewayEvent, Context, Handler } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import dynamoDb from "../dynamodb";
import * as Joi from "@hapi/joi";

export const handler: Handler = async (
  event: APIGatewayEvent,
  _context: Context
) => {
  const data = JSON.parse(event.body);

  const schema = Joi.object({
    coupon_code: Joi.string().required(),
    minimum_amount: Joi.number()
      .min(0)
      .required(),
    discount_percentage: Joi.number()
      .integer()
      .min(0)
      .max(100)
      .required(),
    maximum_amount: Joi.number()
      .min(0)
      .required(),
    validity: Joi.number()
      .integer()
      .min(0)
      .max(30)
      .required()
  });

  const { error } = schema.validate(data);

  if (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        message: error.details
      })
    };
  }

  const timestamp = new Date().getTime();
  const coupon_id = uuidv4();
  const discount_id = "percent-" + uuidv4();
  const {
    coupon_code,
    minimum_amount,
    validity,
    discount_percentage,
    maximum_amount
  } = data;

  const start_date = new Date();
  let end_date = new Date();
  end_date.setDate(end_date.getDate() + validity);

  const couponItem = {
    coupon_id,
    discount_type: "percentdiscount",
    coupon_code,
    minimum_amount,
    start_date,
    end_date,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const percentDiscountItem = {
    coupon_id,
    discount_id,
    discount_percentage,
    maximum_amount
  };

  const params = {
    RequestItems: {
      coupons: [
        {
          PutRequest: {
            Item: couponItem
          }
        }
      ],
      percentdiscount: [
        {
          PutRequest: {
            Item: percentDiscountItem
          }
        }
      ]
    },
    ReturnConsumedCapacity: "TOTAL"
  };

  try {
    await dynamoDb.batchWrite(params).promise();
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true
      },
      body: JSON.stringify({
        success: true,
        message: "Percent coupon added successfully!"
      })
    };
  } catch (err) {
    if (err)
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true
        },
        body: JSON.stringify({
          sucess: false,
          message: err.message
        })
      };
  }
};

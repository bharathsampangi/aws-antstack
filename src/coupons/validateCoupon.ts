import { APIGatewayEvent, Context, Handler } from "aws-lambda";
import dynamoDb from "../dynamodb";
import * as Joi from "@hapi/joi";

enum DiscountType {
  "flatdiscount",
  "percentdiscount"
}

export const handler: Handler = async (evt: APIGatewayEvent, _ctx: Context) => {
  const data = JSON.parse(evt.body);

  const schema = Joi.object({
    coupon_code: Joi.string().required(),
    total_amount: Joi.number()
      .min(0)
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

  const { coupon_code, total_amount } = data;

  const params = {
    TableName: "coupons",
    IndexName: "coupons_index",
    KeyConditionExpression: "coupon_code = :coupon_code",
    ExpressionAttributeValues: {
      ":coupon_code": coupon_code
    }
  };

  try {
    const result = await dynamoDb.query(params).promise();
    const coupon = result.Items[0];
    if (result && result.Items && result.Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          valid: false,
          discount: 0,
          message: "Sorry, could not find your coupon!"
        })
      };
    }
    const { coupon_id, discount_type, minimum_amount, end_date } = coupon;

    //check expiry
    if (end_date < Date.now()) {
      return {
        statusCode: 406,
        body: JSON.stringify({
          valid: false,
          discount: 0,
          message: "Sorry, your coupon has been expired!"
        })
      };
    }

    //check minimum amount
    if (total_amount < minimum_amount) {
      return {
        statusCode: 406,
        body: JSON.stringify({
          valid: false,
          discount: 0,
          message: "Your cart value is less than minimum amount."
        })
      };
    }

    //Calculate flat discount
    if (discount_type === DiscountType[0]) {
      const flatDiscount = await resolveFlatDiscount(coupon_id);
      return {
        statusCode: 200,
        body: JSON.stringify(flatDiscount)
      };
    }

    //Calculate percent discount
    if (discount_type === DiscountType[1]) {
      const percentDiscount = await resolvePercentDiscount(
        coupon_id,
        total_amount
      );
      return {
        statusCode: 200,
        body: JSON.stringify(percentDiscount)
      };
    }
  } catch (err) {
    if (err)
      return {
        statusCode: 500,
        body: JSON.stringify({
          valid: false,
          discount: 0,
          message: err.message
        })
      };
  }
};

const resolveFlatDiscount = async (coupon_id: string) => {
  const flatParams = {
    TableName: "flatdiscount",
    KeyConditionExpression: "coupon_id = :coupon_id",
    ExpressionAttributeValues: {
      ":coupon_id": coupon_id
    },
    ProjectionExpression: "discount_amount"
  };
  const flatResult = await dynamoDb.query(flatParams).promise();

  const { discount_amount } = flatResult.Items[0];
  const flatDiscount = {
    valid: true,
    discount: discount_amount,
    message: "Success - your coupon has been applied."
  };
  return flatDiscount;
};

const resolvePercentDiscount = async (
  coupon_id: string,
  total_amount: number
) => {
  const percentParams = {
    TableName: "percentdiscount",
    KeyConditionExpression: "coupon_id = :coupon_id",
    ExpressionAttributeValues: {
      ":coupon_id": coupon_id
    },
    ProjectionExpression: "discount_percentage, maximum_amount"
  };
  const percentResult = await dynamoDb.query(percentParams).promise();
  const { discount_percentage, maximum_amount } = percentResult.Items[0];
  let discount = calculateDiscountFromPercentage(
    total_amount,
    discount_percentage,
    maximum_amount
  );
  let percentDiscount = {
    valid: true,
    discount,
    message: "Success - your coupon has been applied."
  };
  return percentDiscount;
};

//Utility method
const calculateDiscountFromPercentage = (
  totalAmount: number,
  discountPercentage: number,
  maxAmount: number
) => {
  discountPercentage = discountPercentage / 100;
  let discount = totalAmount * discountPercentage;
  if (discount > maxAmount) {
    discount = maxAmount;
  }
  return discount;
};

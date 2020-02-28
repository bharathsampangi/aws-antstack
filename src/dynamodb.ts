import { DynamoDB } from "aws-sdk";

var options: { region: string; endpoint: string } = {
  region: "",
  endpoint: ""
};
if (process.env.IS_OFFLINE) {
  options.region! = "localhost";
  options.endpoint = "http://localhost:8000";
}

const dynamoDb = new DynamoDB.DocumentClient(options);
export default dynamoDb;

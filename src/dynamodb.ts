import { DynamoDB } from "aws-sdk";

var options: { region: string; endpoint: string } = {
  region: "",
  endpoint: ""
};
if (process.env.IS_OFFLINE) {
  options.region = "localhost";
  options.endpoint = "http://localhost:8000";
}
//Uncomment below code for dev mode.
//const dynamoDb = new DynamoDB.DocumentClient(options);

//Comment below code for dev mode.
const dynamoDb = new DynamoDB.DocumentClient();

export default dynamoDb;

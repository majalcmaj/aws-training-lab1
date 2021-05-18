"use strict";

const _ = require('lodash');
const {DynamoDBClient, PutItemCommand, GetItemCommand} = require('@aws-sdk/client-dynamodb');
const DYNAMODB_TABLE_NAME = "challenge-table";

const dbClient = new DynamoDBClient({region: "eu-west-1"});

async function doGet(event) {
    const id = event.pathParameters.id;
    const dbCallResult = dbClient.send(new GetItemCommand({
        TableName: DYNAMODB_TABLE_NAME,
        Key: {id: {N: `${id}`}},
        ProjectionExpression: "winners"
    }));
    try {
        const value = await dbCallResult;
        return {statusCode: 200, body: value.Item.winners.S};
    } catch (err) {
        return {statusCode: 404, body: "Challenge with the given ID does not exist."};
    }
}

async function doPost(event) {
    const {ok, ...payload} = parseBody(event.body);

    if (!ok) {
        return {statusCode: 400, body: payload.message}
    }
    const challengeResults = getChallengeResults(payload);
    const dbCallResult = dbClient
        .send(new PutItemCommand({
            TableName: DYNAMODB_TABLE_NAME,
            Item: {
                id: {N: `${payload.challengeID}`},
                winners: {S: JSON.stringify(challengeResults)}
            },
            ReturnValues: "ALL_OLD"
        }));
    try {
        await dbCallResult;
        return {statusCode: 200, body: JSON.stringify(challengeResults)};
    } catch (err) {
        console.log(err)
        return {statusCode: 500, body: {errorMessage: err.message}};
    }

    function parseBody(bodyJSON) {
        try {
            const {challengeID, winners, students} = JSON.parse(bodyJSON);
            return {ok: true, challengeID, winners, students: _.split(students, ",")}
        } catch (e) {
            return {
                ok: false,
                message: "Could not parse, payload should be JSON with 'challengeID', 'winners' and 'students' keys."
            }
        }
    }

    function getChallengeResults({challengeID, students, winners}) {
        const studentsArray = _.split(students, ",")
        return _.sampleSize(studentsArray, winners);
    }
}

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
exports.lambdaHandler = async (event, context) => {
    switch (event.httpMethod) {
        case "GET":
            return doGet(event);
        case "POST":
            return doPost(event);
        default:
            return {statusCode: 405, body: "Only GET and POST methods are allowed on this resource."}
    }
};

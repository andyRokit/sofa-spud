import { Construct } from 'constructs'

import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as events from 'aws-cdk-lib/aws-events'
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'


export interface DynamoEventEmitterProps {
    readonly prefix: string,
    readonly table: dynamodb.Table,
    readonly bus: events.EventBus
}

/**
 * Consumes DynamoDB stream events and converts them to EventBridge events on the specific Event Bus.
 * 
 * Format of produced events:
 * 
 * {
 *   "Entries": [
 *     {
 *       "Source": <table name>,
 *       "DetailType": <dynamo event>,
 *       "Detail:": {
 *         "values": <new image expressed as JSON>,
 *         "updatedFields": <if update, list of field names that have changed>
 *       }
 *     }
 *   ]
 * }
 * 
 * Prerequisiites: DynamoDB table must have stream enabled with NEW_AND_OLD_IMAGES
 */
export class DynamoEventEmitter extends Construct {
    constructor(scope: Construct, id: string, props: DynamoEventEmitterProps) {
        super(scope, id)

        const emitFn = new lambda.Function(this, 'emitFn', {
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('assets/helpers/dynamo-event-emitter/emit-fn'),
            environment: {
                eventBusName: props.bus.eventBusName,
                source: props.table.tableName
            }
        })

        emitFn.role?.attachInlinePolicy(
            new iam.Policy(this, 'PublishToEventBridge', {
                statements: [
                    new iam.PolicyStatement({
                        actions: ['events:PutEvents'],
                        resources: [props.bus.eventBusArn]
                    })                
                ]
            })
        )

        emitFn.addEventSource(new DynamoEventSource(props.table, {
            startingPosition: lambda.StartingPosition.LATEST
        }))
    }
}
import { Construct } from 'constructs'

import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as events from 'aws-cdk-lib/aws-events'

export interface FulfillmentServiceProps {
    readonly prefix: string,
    readonly bus: events.EventBus,
    readonly orderApi: apigateway.IRestApi
}

export class FulfillmentService extends Construct {
    
}
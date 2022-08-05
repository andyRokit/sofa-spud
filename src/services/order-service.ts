import { Construct } from 'constructs'
import CdkHelper from '../helpers/cdk-helper'

import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import { RemovalPolicy } from 'aws-cdk-lib'


export interface OrderServiceProps {
    readonly prefix: string,
    readonly vpceResourcePolicy: iam.PolicyDocument
}

export class OrderService extends Construct {
    public api: apigateway.IRestApi
    
    constructor(scope: Construct, id: string, props: OrderServiceProps) {
        super(scope, id)

        const orderTable = new dynamodb.Table(this, 'orderTable', {
            tableName: `${props.prefix}-Order`,
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            removalPolicy: RemovalPolicy.DESTROY  
        })

        CdkHelper.hardcodeLogicalId(orderTable, 'orderTable')

const orderRole = new iam.Role(this, `${props.prefix}-Role`, {
    assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    inlinePolicies: {
        'tableAccess': new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    actions: ['dynamodb:*'],
                    resources: [orderTable.tableArn]
                })
            ]
        })
    }
})

CdkHelper.hardcodeLogicalId(orderRole, 'orderRole')

const apiDefinition = CdkHelper.createApiDefinition(this, 'assets/services/order/openapi-spec.yaml')

        this.api = new apigateway.SpecRestApi(this, `${props.prefix}-Orders-Api`, {
            apiDefinition: apiDefinition,
            endpointTypes: [apigateway.EndpointType.PRIVATE],
            policy: props.vpceResourcePolicy,
        })
    }
}
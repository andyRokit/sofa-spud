import { Construct } from 'constructs'
import CdkHelper from '../helpers/cdk-helper'

import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import { CfnParameter, NestedStack, NestedStackProps } from 'aws-cdk-lib'


export interface CustomerGatewayProps extends NestedStackProps {
    readonly prefix: string
}

export class CustomerGateway extends NestedStack {
    public api: apigateway.IRestApi

    constructor(scope: Construct, id: string, props: CustomerGatewayProps) {
        super(scope, id, props)

        new CfnParameter(this, 'vpcLinkId', {type: 'String'})
        new CfnParameter(this, 'privateGatewayBaseUrl', {type: 'String'})
        new CfnParameter(this, 'orderServiceApiId', {type: 'String'})


        const apiDefinition = CdkHelper.createApiDefinition(this, 'assets/gateways/customer/openapi-spec.yaml')

        this.api = new apigateway.SpecRestApi(this, `${props.prefix}-Customer-Gateway`, {
            apiDefinition: apiDefinition
        })
    }
}
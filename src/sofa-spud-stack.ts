import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CustomerGateway } from './gateways/customer-gateway';
import { Network } from './infrastructure/network';
import { OrderService } from './services/order-service';

export class SofaSpudStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const network = new Network(this, 'networkStack', {
      prefix: this.stackName
    })

    const orderService = new OrderService(this, 'orderService', {
      prefix: this.stackName,
      vpceResourcePolicy: network.vpceResourcePolicy
    })

    const customerGateway = new CustomerGateway(this, 'customerGateway', {
      prefix: this.stackName,
      parameters: {
        vpcLinkId: network.vpcLink.vpcLinkId,
        privateGatewayBaseUrl: network.privateGatewayBaseUrl,
        orderServiceApiId: orderService.api.restApiId
      }
    })
  }
}

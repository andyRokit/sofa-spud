import { Aws, CfnOutput, CfnParameter, Fn, Token } from 'aws-cdk-lib'
import { Construct } from 'constructs'

import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as targets from 'aws-cdk-lib/aws-route53-targets'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as cr from 'aws-cdk-lib/custom-resources'
import * as elbv2_targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets'
import * as iam from 'aws-cdk-lib/aws-iam'


export interface NetworkProps {
    readonly prefix: string
}

export class Network extends Construct {
    public readonly vpc: ec2.Vpc
    public readonly vpcLink: apigateway.VpcLink
    public readonly vpceResourcePolicy: iam.PolicyDocument
    public readonly privateGatewayBaseUrl: string


    constructor(scope: Construct, id: string, props: NetworkProps) {
        super(scope, id)

        this.vpc = new ec2.Vpc(this, 'vpc', {
            vpcName: `${props.prefix}-vpc`,
            cidr: '10.0.0.0/16'
        })

        const nlb = new elbv2.NetworkLoadBalancer(this, 'nlb', {
            loadBalancerName: `${props.prefix}-nlb`,
            vpc: this.vpc
        })

        this.vpcLink = new apigateway.VpcLink(this, 'vpcLink', {
            targets: [nlb]
        })

        const gatewayVpce = new ec2.InterfaceVpcEndpoint(this, `${props.prefix}-VpcE`, { privateDnsEnabled: false, service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY, vpc: this.vpc })

        this.vpceResourcePolicy = this.createVpceResourcePolicy(gatewayVpce)
        this.privateGatewayBaseUrl = this.createRouteToVpce(gatewayVpce, nlb, 5001)
    }

    /**
     * Creates a Route53 domain for the NLB.  Creates a Target Group from the NLB to the VPC Endpoint.
     * 
     * @param vpce The VPC Endpoint to target
     * @param nlb The NLB to use
     * @param port The port to use
     * @returns The base URL of the route to the VPC Endpoint
     */
    private createRouteToVpce(vpce: ec2.InterfaceVpcEndpoint, nlb: elbv2.NetworkLoadBalancer, port: number): string {
        const nlbDomain = this.createNlbDomain(nlb)

        const gatewayTargetGroup = this.createVpceTargetGroup(vpce)

        nlb.addListener('VpcE-Listener', {
            port: port,
            defaultTargetGroups: [gatewayTargetGroup]
        })

        return `https://${nlbDomain}:${port}`
    }

    /**
     * Creates a target group for the specified VPC Endpoint.
     * 
     * Currently Network interfaces are automatically created when a VPC Enpoint is created.  The IPs of these addresses are not available through CloudFormation.
     * This solution involves using a custom resources to call describe-network-interfaces [1] for each AZ to get the IPS, then adding them as targets.
     * 
     * A ticket [2] has been raised with CloudFormation to address this.
     * 
     * [1] https://awscli.amazonaws.com/v2/documentation/api/latest/reference/ec2/describe-network-interfaces.html
     * [2] https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/1254
     * 
     * @param vpce The VPC Endpoint to target
     * @returns Target group for the VPC Endpoint
     */
    private createVpceTargetGroup(vpce: ec2.InterfaceVpcEndpoint): elbv2.NetworkTargetGroup {
        const targetGroup = new elbv2.NetworkTargetGroup(this, 'VpcE-Targets', {
            vpc: this.vpc,
            port: 443,
            targetGroupName: `${vpce.vpcEndpointId}-Targets`
        })

        for (let index = 0; index < this.vpc.availabilityZones.length; index++) {
            const getEndpointIp = new cr.AwsCustomResource(this, `GetEndpointIp${index}`, {
                onUpdate: {
                    service: 'EC2',
                    action: 'describeNetworkInterfaces',
                    outputPaths: [`NetworkInterfaces.${index}.PrivateIpAddress`],
                    parameters: { NetworkInterfaceIds: vpce.vpcEndpointNetworkInterfaceIds },
                    physicalResourceId: cr.PhysicalResourceId.of(`NetworkInterfaces.${index}.PrivateIpAddress`)
                },
                policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                    resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE
                })
            });
            targetGroup.addTarget(new elbv2_targets.IpTarget(Token.asString(getEndpointIp.getResponseField(`NetworkInterfaces.${index}.PrivateIpAddress`))))
        }

        return targetGroup
    }

    /**
     * Creates an API Gateway Resource Policy which only allows traffic from the specified VPC Endpoint
     * 
     * @param vpce The VPC Endpoint to allow traffic from
     */
    private createVpceResourcePolicy(vpce: ec2.InterfaceVpcEndpoint): iam.PolicyDocument {
        return new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    principals: [new iam.AnyPrincipal()],
                    actions: ['execute-api:Invoke'],
                    resources: [`arn:aws:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:*`],
                }),
                new iam.PolicyStatement({
                    effect: iam.Effect.DENY,
                    principals: [new iam.AnyPrincipal()],
                    actions: ['execute-api:Invoke'],
                    resources: [`arn:aws:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:*`],
                    conditions: { StringNotEquals: { 'aws:SourceVpce': vpce.vpcEndpointId } },
                }),
            ],
        })
    }

    /**
     * Creates a Route53 domain for the NLB.
     * 
     * Note:  The URL is a subdomain of 'execute-api.${AWS::Region}.amazonaws.com' as this will match the TLS cert of the destination (where the TLS connection is terminated).
     *        I.e. The API Gateway (*.execute-api.region>.amazonaws.com)
     * 
     * @param nlb The NLB to add the route to
     * @returns The domain created
     */
    private createNlbDomain(nlb: elbv2.NetworkLoadBalancer): string {
        const nlbZone = new route53.PrivateHostedZone(this, 'nlbZone', {
            vpc: this.vpc,
            zoneName: Fn.join('.', [nlb.loadBalancerName, Fn.sub('execute-api.${AWS::Region}.amazonaws.com')])
        })

        new route53.ARecord(this, 'nlbRecord', {
            zone: nlbZone,
            target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(nlb))
        })

        return nlbZone.zoneName
    }
}
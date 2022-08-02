import { CfnResource, Fn } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { Asset } from 'aws-cdk-lib/aws-s3-assets'

import * as apigateway from 'aws-cdk-lib/aws-apigateway'


export default class CdkHelper {
    /**
     * CDK generates logical IDs for CF resources, which means we can't depend on them in templates (such as OpenApi sepcs)
     * This method forces CDK to give these a fixed ID in the templates.
     */
    static hardcodeLogicalId(construct: Construct, newLogicalId: string) {
        const resource = construct.node.defaultChild as CfnResource
        resource.overrideLogicalId(newLogicalId)
    }

    /**  
     * Creates an ApiDefinition from an OpenApi spec file.
     * Enables use of CloudFormation variables (such as ARNs) in the file.
     */
     static createApiDefinition(scope: Construct, specPath: string) : apigateway.ApiDefinition {
        // Upload spec to S3
        const originalSpec = new Asset(scope, 'originalAsset', {
            path: specPath
        })

        // Pulls the content back into the template.  Being inline, this will now respect CF references within the file.
        const transformedSpec = Fn.transform('AWS::Include', {
            'Location': originalSpec.s3ObjectUrl
        })

        return apigateway.AssetApiDefinition.fromInline(transformedSpec)
    }
}
#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { SofaSpudStack } from './sofa-spud-stack'
import { Tags } from 'aws-cdk-lib'

const app = new cdk.App();
new SofaSpudStack(app, 'sofaspud')
Tags.of(app).add('app', 'SofaSpud')
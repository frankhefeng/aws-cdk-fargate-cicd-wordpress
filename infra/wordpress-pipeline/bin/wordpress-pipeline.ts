#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { WordpressPipelineStack } from '../lib/wordpress-pipeline-stack';

if (!process.env.domainName) {
    console.error("please define domainName envionment variable!! \nRUN:")
    console.error("domainName=mydomain.com cdk deploy \nOR \ndomainName=mydomain.com subDomainName=blog cdk deploy ")
    process.exit(1)
}

const app = new cdk.App();
new WordpressPipelineStack(app, 'WordpressPipelineStack', {
    appName: 'Wordpress',
    cidr: '10.0.0.0/16',
    maxAzs: 3,
    codeCommitRepoName: 'Wordpress',
    ecrRepoName: 'wordpress',
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
    domainName: process.env.domainName!,
    subDomainName: process.env.subDomainName || 'wordpress',
});

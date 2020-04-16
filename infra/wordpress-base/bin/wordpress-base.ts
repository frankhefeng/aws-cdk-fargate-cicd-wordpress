#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { WordpressBaseStack } from '../lib/wordpress-base-stack';


const app = new cdk.App();
new WordpressBaseStack(app, 'WordpressBaseStack', {
    codeCommitRepoName: 'Wordpress',
    ercRepoName: 'wordpress',
});

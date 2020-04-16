import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import WordPressPipeline = require('../lib/wordpress-pipeline-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new WordPressPipeline.WordPressPipelineStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});

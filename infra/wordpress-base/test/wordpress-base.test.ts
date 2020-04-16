import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import WordpressBase = require('../lib/wordpress-base-stack');

test('Empty Stack', () => {
  const app = new cdk.App();
  // WHEN
  const appName = 'Wordpress';
  const stack = new WordpressBase.WordpressBaseStack(app, 'MyTestStack', {
    codeCommitRepoName: appName,
    ecrRepo: appName.split(/(?=[A-Z])/).join('_').toLowerCase(),
  });
  // THEN
  expectCDK(stack).to(matchTemplate({
    "Resources": {}
  }, MatchStyle.EXACT))
});

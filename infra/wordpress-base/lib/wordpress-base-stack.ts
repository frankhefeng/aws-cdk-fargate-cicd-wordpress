import * as cdk from '@aws-cdk/core';
import codecommit = require('@aws-cdk/aws-codecommit');
import ecr = require('@aws-cdk/aws-ecr');

export interface WordpressBaseStackProps extends cdk.StackProps {
  codeCommitRepoName: string;
  ercRepoName: string,
}

export class WordpressBaseStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: WordpressBaseStackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const repo = new codecommit.Repository(this, 'CodeCommitRepo', {
      repositoryName: props.codeCommitRepoName
    })

    const ecrRepo = new ecr.Repository(this, 'ecrRepo', { repositoryName: props.ercRepoName });

    new cdk.CfnOutput(this, 'CodeCommitRepoArn', { value: `${repo.repositoryArn}` })
    new cdk.CfnOutput(this, 'CodeCommitRepoUrl', { value: `${repo.repositoryCloneUrlSsh}` })

    new cdk.CfnOutput(this, 'ecrRepoUrl', { value: `${ecrRepo.repositoryUri}` })
  }
}

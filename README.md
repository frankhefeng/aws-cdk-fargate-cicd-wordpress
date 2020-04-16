# AWS CDK implementation of CI/CD pipeline for WordPress on Fargate
This project deploys WordPress on Amazon Fargate using a CI/CD pipeline with AWS CDK TypeScript.

## How to use
1. Configure AWS CLI as per instruction [Installing the AWS CLI version 2](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
2. Configure AWS CDK  **TypeScript** environment as per instruction [Getting Started With the AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html)
3. Configure AWS CodeCommit  **Credentials**  as per instruction [Configure Credentials on Linux, macOS, or Unix](https://docs.aws.amazon.com/zh_cn/codecommit/latest/userguide/setting-up-ssh-unixes.html#setting-up-ssh-unixes-keys)
4. Go to `infra/wordpress-base` folder, run `npm run build` to compile the scripts, then run `cdk deploy` to create resources below:
- one **CodeCommit Repository** shared by dev/prod envionments
- two **ECR Repositories** for dev/prod envionments each

Output of `cdk deploy`:
```
CommonStack.EcrRepoUrl = 888888888888.dkr.ecr.us-east-1.amazonaws.com/wordpress
CommonStack.CodeCommitRepoArn = arn:aws:codecommit:us-east-1:888888888888:wordpress
CommonStack.CodeCommitRepoUrl = ssh://git-codecommit.us-east-1.amazonaws.com/v1/repos/wordpress
```

5. Push all source code to the new created CodeCommit repository.  
6. In AWS console, Go to ECR service, and find new created `wordpress` repository, then click `View push commands` button, execute all commands under folder `wordpress`. 
7. Go to `infra/wordpress-pipeline` folder, run `npm run build` to compile the scripts, then run `domainName=example.com subDomainName=blog cdk deploy `. This will create CI/CD pipeline. (example.com should be a Hosted domain in Route53)



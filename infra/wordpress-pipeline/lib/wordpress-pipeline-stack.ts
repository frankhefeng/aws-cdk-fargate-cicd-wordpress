import * as cdk from '@aws-cdk/core';
import codecommit = require('@aws-cdk/aws-codecommit');
import ec2 = require('@aws-cdk/aws-ec2');
import ecr = require('@aws-cdk/aws-ecr');
import ecs = require('@aws-cdk/aws-ecs');
import rds = require('@aws-cdk/aws-rds');
import iam = require('@aws-cdk/aws-iam')
import codebuild = require('@aws-cdk/aws-codebuild');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import ecs_patterns = require('@aws-cdk/aws-ecs-patterns');
import * as logs from '@aws-cdk/aws-logs';
import secretsmanager = require('@aws-cdk/aws-secretsmanager');
import route53 = require('@aws-cdk/aws-route53');
import elbv2 = require("@aws-cdk/aws-elasticloadbalancingv2");
import acm = require('@aws-cdk/aws-certificatemanager');

export interface WordpressPipelineStackProps extends cdk.StackProps {
  appName: string;
  cidr: string;
  maxAzs: number;
  codeCommitRepoName: string;
  ecrRepoName: string,
  domainName: string,
  subDomainName: string,
}

export class WordpressPipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: WordpressPipelineStackProps) {
    super(scope, id, props);

    const stackPrefix = props.appName;

    var vpc = null
    //Use NAT Gateway by CDK default in production env
    vpc = new ec2.Vpc(this, 'vpc', {
      maxAzs: props.maxAzs,
      cidr: props.cidr,
    })

    const cluster = new ecs.Cluster(this, 'cluster', {
      vpc: vpc
    })

    const codeCommitRepo = codecommit.Repository.fromRepositoryName(this, 'CodeCommitRepo', props.codeCommitRepoName);
    const ecrRepo = ecr.Repository.fromRepositoryName(this, 'ecrRepo', props.ecrRepoName)
    const fargateLogGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: stackPrefix + 'Fargate',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const taskRole = new iam.Role(this, 'FargateTaskRole', {
      roleName: stackPrefix + 'FargateTaskRole',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
    });

    const secret = new secretsmanager.Secret(this, 'DBSecret', {
      secretName: "wordpressDBPassword",
      generateSecretString: {
        excludePunctuation: true
      }
    });

    const db = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.AURORA,
      defaultDatabaseName: 'wordpress',
      masterUser: {
        username: 'root',
        password: secret.secretValue
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.SMALL),
        vpc: vpc
      }
    });

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.domainName
    });

    const cert = new acm.DnsValidatedCertificate(this, 'WordpressCert', {
      hostedZone,
      domainName: '*.' + props.domainName,
    });

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, "WordpressService", {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(ecrRepo),
        enableLogging: true,
        logDriver: new ecs.AwsLogDriver({
          streamPrefix: stackPrefix,
          logGroup: fargateLogGroup,
        }),
        taskRole: taskRole,
        secrets: {
          'WORDPRESS_DB_PASSWORD': ecs.Secret.fromSecretsManager(secret)
        },
        environment: {
          'WORDPRESS_DB_USER': 'root',
          'WORDPRESS_DB_HOST': db.clusterEndpoint.hostname,
          'WORDPRESS_DB_NAME': 'wordpress',
        },
        containerPort: 80,
      },
      memoryLimitMiB: 1024,
      cpu: 512,
      desiredCount: 1,
      publicLoadBalancer: true,
      domainName: props.subDomainName + '.' + props.domainName,
      domainZone: hostedZone,
      protocol: elbv2.ApplicationProtocol.HTTPS,
    });

    fargateService.listener.addCertificateArns('acm', [cert.certificateArn])

    db.connections.allowDefaultPortFrom(fargateService.service, 'From Fargate');

    const pipeline = new codepipeline.Pipeline(this, stackPrefix + 'Pipeline');

    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      repository: codeCommitRepo,
      output: sourceOutput
    });
    const sourceStage = pipeline.addStage({
      stageName: 'Source'
    });
    sourceStage.addAction(sourceAction);

    //build docker image from source then push it to ECR
    const fargateBuildProject = new codebuild.PipelineProject(this, "Build", {
      description: "Build project for the Fargate pipeline",
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_3_0,
        privileged: true
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          pre_build: {
            commands: [
              "echo Logging in to Amazon ECR...",
              "aws --version",
              "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com",
              "COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)",
              "IMAGE_TAG=${COMMIT_HASH:=latest}",
              "echo $(echo $COMMIT_HASH)",
              "echo `image tag:` $(echo $IMAGE_TAG)",
            ]
          },
          build: {
            commands: [
              "echo Build started on`date`",
              "echo Build the Docker image",
              "cd wordpress",
              "docker build -t $ECR_REPOSITORY_NAME:$IMAGE_TAG .",
              "docker tag $ECR_REPOSITORY_NAME:$IMAGE_TAG $ECR_REPOSITORY_URI:$IMAGE_TAG",
            ]
          },
          post_build: {
            commands: [
              "echo Build completed on`date`",
              "echo Pushing the Docker image...",
              "docker push $ECR_REPOSITORY_URI:$IMAGE_TAG",
              "printf '[{\"name\":\"web\",\"imageUri\":\"%s\"}]' $ECR_REPOSITORY_URI:$IMAGE_TAG > ../imagedefinitions.json",
            ]
          }
        },
        artifacts: {
          files: 'imagedefinitions.json',
        }
      }),
      environmentVariables: {
        'ACCOUNT_ID': {
          value: this.account,
        },
        'ECR_REPOSITORY_NAME': {
          value: ecrRepo.repositoryName,
        },
        'ECR_REPOSITORY_URI': {
          value: ecrRepo.repositoryUri,
        },
      }
    });
    ecrRepo.grantPullPush(fargateBuildProject);

    const fargateBuildOutput = new codepipeline.Artifact("fargateBuildOutput");
    const buildStage = pipeline.addStage({
      stageName: 'Build'
    });
    buildStage.addAction(new codepipeline_actions.CodeBuildAction({
      actionName: 'DockerBuild',
      project: fargateBuildProject,
      input: sourceOutput,
      outputs: [fargateBuildOutput],
    }));

    //deploy latest ECR image to Fargate
    const deployStage = pipeline.addStage({
      stageName: 'Deploy'
    });

    deployStage.addAction(new codepipeline_actions.EcsDeployAction({
      actionName: 'ECSDeploy',
      service: fargateService.service,
      input: fargateBuildOutput,
    }))
  }
}

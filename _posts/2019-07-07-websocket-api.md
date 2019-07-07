---
published: true
title: AWS WebSocket API 써보기
layout: post
tags: aws server serverless
---

웹 채팅 서비스를 만들어본다고 생각해보자. 물론 저기에는 수많은 기능이 있겠지만 다 떼어내고 가장 기본적인 기능인, Web interface를 통해서 사용자와 운영자가 실시간으로 채팅을 할 수 있는 부분을 만든다고 생각을 해보자.

일단 클라이언트의 HTTP 요청에 대해 서버에서 응답하는 구조인 HTTP의 특성으로 인해 상호간의 실시간 채팅을 위해서는 단순히 클라이언트가 요청해서 그 답을 구해내는 구조는 다소 부족해보인다. 물론 주기적으로 계속 서버 측에서 할 말이 있는지 물어보는 polling 방법을 사용할 수도 있겠지만 이것은 할 말이 없을 때에도 계속 클라이언트의 요청을 받아야한다는 뜻이므로 꽤나 비효율적이 될 수 있다. 즉, 이는 ServerPush에 대한 고민을 좀 해야 한다는 뜻인데, WebRTC와 같이 다소 복잡한 방법을 사용하지 않아도 다행히 HTTP에서는 WebSocket protocol을 제공해주므로 이 연결을 통해 실시간으로 데이터를 주고 받는 문제는 쉽게 해결할 수 있다.

#### Dedicated Server

사실 이 문제는 NodeJS의 [socket.io](https://socket.io) 등을 사용해서 서버를 만들면 클라이언트에서도 동일한 라이브러리를 사용해서 쉽게 채팅 서비스를 만들 수 있다. 다만 이 경우 이렇게 만든 서버를 서비하기 위해 적절한 서버 인스턴스를 구축 혹은 클라우드 서비스에서 할당하여 배포 파이프라인을 구축하고 요청량에 따라 적절히 확장될 수 있도록 모니터링 혹은 자동화를 하고 에러 등에 의한 자동/수동 복구를 통한 가용성 확보도 필수다. 즉, 서버를 직접 만드는 작업도 일이지만 그렇게 만들어진 서버를 서비스 운영을 위해 관리하는 작업 또한 꽤 크다는 뜻이다. 물론 요새는 docker로 containerization을 하고 docker-compose나 k8s로 관리하면 되는 세상이 되었으므로 다소 정답에 가까운 운영 정책을 사용할 수 있지만 본 글에서는 약간 초점을 바꿔서 AWS에서 밀고 있는 **서버리스** 를 기반으로 이런 서비스를 구축하는 방법에 대해서 알아보려고 한다.

#### AWS Serverless

[AWS 서버리스](https://aws.amazon.com/serverless/)는 서버에 대한 운영과 관리에 대한 고민을 줄이고 서버의 기능에 집중할 수 있도록 도와주는 서비스로 혹자는 _Function as a Service_ 패러다임이라고 부르고 있다. 개인적으로는 이 서비스를 알게 된 이후 취미 프로젝트를 서버리스로 재구성하는 작업을 진행하고 있는데 그 이유는,

- 서버 인스턴스를 직접 관리할 필요가 없고,
- 혹시나 요청이 많아질 경웨 _적당한 선에서_ 알아서 scale out을 수행하고,
- **사용자로부터 받은 요청을 처리하기까지 소모된 자원 혹은 요청에 따른 과금을 진행한다.**

이게 HTTP 요청과 같이 단발성으로 stateless하게 처리되는 것 말고도 WebSocket과 같이 stateful한 connection에 대해서도 처리가 가능하다는 것은 굉장히 재미있는 점인데, 이에 대해서는 나중에 모사를 통해 이해해보기로 하고 일단은 이를 사용해서 웹 채팅 backend를 구축해보자.

개발은 NodeJS 10.x를 사용할 것이고, CloudFormation를 통한 Lambda 배포 대신 [Serverless Framework](https://serverless.com)을 사용할 것이다. 그리고 TypeScript를 사용할 것이다. _이 글에서 각각을 다 설명하기엔 너무 길어서 일단 다 알고 있다는 가정 하에 다음 내용으로 넘어가겠다._

좀 더 구체적인 것을 이해하려면 다음 글이 더 나을 수 있다. API documentation은 개인적인 생각으로는 아예 날 잡고 정독을 하지 않는한 크게 도움이 되지 않았던 경험이 있다.

- [Announcing WebSocket APIs in Amazon API Gateway](https://aws.amazon.com/ko/blogs/compute/announcing-websocket-apis-in-amazon-api-gateway/)
- [AWS WebSocket API 문서](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html)

#### AWS APIGateway WebSocketAPI RouteKey

AWS APIGateway가 HTTP endpoint에 호출되는 HTTP method 별로 AWS Lambda proxy를 구성할 수 있었다면, AWS WebSocket API는 다음 세 가지의 기본 `routeKey`를 갖는다.

| `routeKey`   | 설명                                                                                                                                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \$connect    | 클라이언트가 연결을 요청했을 때                                                                                                                                                                                                                                       |
| \$disconnect | 클라이언트가 연결을 끊었을 때                                                                                                                                                                                                                                         |
| \$default    | 클라이언트가 별도의 [`Selection Expression`](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-selection-expressions.html#apigateway-websocket-api-route-selection-expressions)을 지정하지 않았을 때 기본으로 사용되는 `routeKey` |

`Selection Expression`에 대해서는 나중에 다시 설명하기로 하고, 일단은 `$default`가 클라이언트가 연결을 성공한 이후 보내는 모든 메시지에 대해 호출되는 Lambda handler의 `routeKey`라고 생각하면 편할 것 같다.

#### 개발환경 준비

이제 실제 프로그래밍을 시작해보자. 설치된 `Serverless Framework`을 통해 다음과 같이 프로젝트를 시작할 수 있다. 물론 `Serverless Framework`이 설치되지 않았다면 `npm i -g serverless`로 설치를 해주면 된다.

```bash
$ mkdir websocket-chat/ && cd websocket-chat/
$ sls create --template aws-nodejs-typescript --name websocket-chat
Serverless: Generating boilerplate...
...
Serverless: Successfully generated boilerplate for template: "aws-nodejs-typescript"

$ ls
handler.ts  package.json  serverless.yml  tsconfig.json  webpack.config.js
```

이제

- `serverless.yml` 파일에 배포에 관련된 권한, 자원 설정과 WebSocekt API의 event를 적절한 Lambda function의 entrypoint로 연결해주는 선언을 하고,
- `handler.ts`에서 각 event에 맞는 Lambda function을 기술해주면 되겠다.

event는 위에서 언급한 것과 같이 `$connect`, `$disconnect`, `$default` 3개가 있고 이 이 때,

- `$connect`에서 클라이언트의 **connection** 을 **어딘가에 저장** 해두고
- `$default`에서 메시지를 받았을 때 **저장된** **connection**을 모두 가져와서 **send**를 해주고,
- `$disconnet`에서 클라이언트의 **connection** 을 **저장된 곳에서 제거** 해주어야 한다.

먼저 _connection_ 은 보통 종래의 서버에서는 추상화된 Connection object를 지칭하고 그 내부로 들어가면 file descriptor나 handle 정도로 볼 수 있다. 즉, peer와 연결되어 있는 kernel 내에서 관리되는 자료구조를 제어하기 위한 번호표를 통해 receive나 send 통신을 요청하는 셈인데 [`WebSocket API` 에서도 이와 동일하게 `connectionId`를 사용](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-mapping-template-reference.html) 해서 [peer로 send를 수행](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-how-to-call-websocket-api-connections.html) 할 수 있다.

그리고 AWS Lambda는 stateless한 computing resource로 persistence를 위한 저장소는 **외부의 것** 을 사용해야 한다. broadcasting을 위해 `connectionId`를 어딘가 보관했다가 읽어오는 작업을 진행해야 하는데 이를 위해 잘 알려진 MySQL이나 Redis, 혹은 DynamoDB 중 어느 것을 써도 문제 없다. 단, Lambda 내의 전역 공간에 in-memory로 저장하거나 혹은 Lambda 내에서 `fs`를 통해 파일로 쓰는 것은 아무 의미가 없는데 이는 매번 필요할 때마다 초기화되어 기동되는 Lambda의 특성으로 인해 그렇게 저장해놓은 데이터는 여러 Lambda instance가 동시에 기동되었을 때 동기화되지 못하거나 혹은 Lambda instance가 terminate되었을 때 모두 소실되기 때문이다. 여기서는 원본 글에서와 같이 `DynamoDB`를 사용하여 connectionId를 관리해보도록 하겠다.

#### \$connect Handler

`connectionId`는 `event.requestContext.connectionId`에 있으니 그걸 가져와서 DynamoDB에 넣어주면 된다.

```typescript
export const connect: APIGatewayProxyHandler = async event => {
  await new DynamoDB()
    .putItem({
      TableName: `ConnectionIds`,
      Item: {
        connectionId: { S: event.requestContext.connectionId }
      }
    })
    .promise();
  return {
    statusCode: 200,
    body: "OK"
  };
};
```

본 예제에서는 편의상 table 이름을 literal로 사용했지만 production에서 보다 나은 코드 관리를 하게 된다면 environment variable 등으로 빼는 것이 훨씬 낫다. 또한 DynamoDB에 [WCU](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadWriteCapacityMode.html)을 초과했을 때 위 요청이 실패할 수도 있으므로 try-catch를 통해 적절한 에러 처리도 필요하다. `$connect` Lambda handler에서 200 응답을 보내지 않은 경우는 에러 상황으로 간주하여 WebSocket 연결이 제대로 수락되지 않는다. _추후 이를 이용하여 권한없이 요청하는 클라이언트의 연결을 거부할 수도 있다._

#### \$disconnect Handler

`ConnectionIds` table은 `connectionId`를 key로 사용하므로 이 값을 사용해 데이터를 제거하면 된다.

```typescript
export const disconnect: APIGatewayProxyHandler = async event => {
  await new DynamoDB()
    .deleteItem({
      TableName: `ConnectionIds`,
      Key: {
        connectionId: { S: event.requestContext.connectionId }
      }
    })
    .promise();
  return {
    statusCode: 200,
    body: "OK"
  };
};
```

이 때에는 에러를 반환해도 이미 클라이언트는 연결을 끊었으므로 그것을 알아챌 좋은 방법은 없다. 때문에 WCU 고갈 등에 의한 오류로 해당 connectionId가 제대로 삭제되지 않아 자원 누수가 발생할 수도 있는데 이를 적절히 defer해서 처리하거나 아니면 `$default` Lambda에서 `send`를 요청했을 때 실패하는 경우 지워주는 방법도 가능은 하다.

#### \$default Handler

`ConnectionIds` table에서 모든 `connectionId`를 `scan`해서 [`ApiGatewayManagementApi#postToConnection`](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/ApiGatewayManagementApi.html)을 사용하여 메시지를 전달한다.

```typescript
export const broadcast: APIGatewayProxyHandler = async event => {
  const dbResult = await new DynamoDB()
    .scan({
      TableName: `ConnectionIds`,
      ProjectionExpression: "connectionId"
    })
    .promise();
  const api = new ApiGatewayManagementApi({
    endpoint: event.requestContext.domainName + "/" + event.requestContext.stage
  });
  await Promise.all(
    dbResult.Items.map(async ({ connectionId }) =>
      api
        .postToConnection({
          ConnectionId: connectionId.S,
          Data: event.body
        })
        .promise()
    )
  );
  return {
    statusCode: 200,
    body: "OK"
  };
};
```

역시 RCU 고갈로 인해 connectionIds를 조회하지 못해 broadcast가 실패할 수 있다. 때문에 connect/disconnect 혹은 message 전송의 빈도수가 높은 경우에는 DynamoDB 대신 아예 dedicated resource인 MySQL이나 Redis를 쓰는 편이 더 적합할 수도 있다. 혹은 DynamoDB의 RCU/WCU를 제한하지 않는 auto provisioning을 사용하는 것도 방법이다. _물론 이 경우 DDoS에 대한 대비를 제대로 하지 않으면 요금 폭탄이 발생할 수도 있는 점은 주의해야 한다._

`ApiGatewayManagementApi`는 `connectionId`를 사용하여 peer로 메시지 전송을 요청하기 위한 API로 `aws-sdk`에 포함되어 있는 WebSocket API client이다. 이 때 요청에 응답하기 위한 `manageConnection`은 각 **WebSocket endpoint** 에 따라 달라지게 되므로 이처럼 `endpoint`에 적절한 주소가 들어갈 수 있도록 해야 한다. 보통 이 주소는 코드보다는 설정을 통해 관리되므로 코드에서는 적절히 `event.requestContext` 객체를 활용하여 `event.requestContext.domainName + / + event.requestContext.stage`로 사용할 수 있다. 이는 보통 생성되는 `PROTOCOL://API-ID.execute-api.REGION.amazonaws.com/STAGE`를 뜻하게 된다. **이 때문에 추후 API Gateway의 [`Custom domain name`](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-custom-domains.html)을 사용하게 될 경우 이 경로를 변경해주어야 하지만** 이 글에서는 거기까지 다루지는 않는다.

역시 중간중간 적절한 예외 처리를 하지 않았지만 예외의 간단함을 위해 넘어가자.

[전체 코드는 다음 위치에서 볼 수 있다.](https://github.com/lacti/websocket-api-sample-chat/blob/master/handler.ts)

#### serverless.yaml

먼저 작성한 함수들을 적절한 websocket의 route에 연결을 해주자.

```yaml
functions:
  connect:
    handler: handler.connect
    events:
      - websocket:
          route: $connect
  disconnect:
    handler: handler.disconnect
    events:
      - websocket:
          route: $disconnect
  broadcast:
    handler: handler.broadcast
    events:
      - websocket:
          route: $default
```

그리고 CloudFormation 식을 사용하여 이 서비스에서 사용할 DynamoDB 테이블을 선언해준다. 그럼 이제 이 서비스가 배포될 때 필요한 DynamoDB 테이블을 같이 생성해주고, 제거할 때 같이 제거해 줄 것이다. ~~좀 더 정확히 말하면, API Gateway와 Lambda, 그리고 logging을 위한 CloudWatch로 이루어진 CloudFormation stack에 DynamoDB table을 포함시켜 같이 관리될 수 있도록 해준다.~~

```yaml
resources:
  Resources:
    ConnectionTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ConnectionIds
        AttributeDefinitions:
          - AttributeName: connectionId
            AttributeType: S
        KeySchema:
          - AttributeName: connectionId
            KeyType: HASH
        ProvisionedThroughput:
          ReadCapacityUnits: 5
          WriteCapacityUnits: 5
```

마지막으로 각 Lambda에서 DynamoDB와 WebSocketAPI에 접근하기 위한 권한(IAM)을 주기 위해서 `provider` section에 다음과 같이 선언한다. 예제를 조금이라도 간결하게 유지하기 위해서 권한을 굉장히 큰 범위(`*`)로 주었다. 실제 서비스를 위한 상황에서는 절대하지 않는 편이 좋다.

```yaml
provider:
  name: aws
  runtime: nodejs10.x
  iamRoleStatements:
    - Effect: "Allow"
      Action:
        - "execute-api:ManageConnections"
      Resource: "*"
    - Effect: "Allow"
      Action:
        - "dynamodb:*"
      Resource: "*"
```

serverless 표현식에 생소하다면 굉장히 당황스러울 수 있는데 그래도 개인적으로는 CloudFormation 선언문보다는 더 간단하다고 생각한다. [`serverless.yaml` 파일의 전체는 다음 위치에서 확인해볼 수 있다.](https://github.com/lacti/websocket-api-sample-chat/blob/master/serverless.yml)

물론 위 선언에는 `region`이 없기 때문에 이대로 배포를 하면 기본 값인 `us-east-1`에 배포된다. 재미로 하는 것이기 때문에 가장 가격이 싼 `us-east-1`을 그대로 사용하는데, 만약 한국에 배포를 하고 싶다면 다음 구문을 `provider`에 추가해주면 된다.

```yaml
provider:
  ...
  region: ap-northeast-2
  ...
```

#### 배포 및 테스트

이제 모든 코드 작업이 완료되었으므로 배포해서 테스트만 하면 된다. [먼저 AWS credential이 잘 설정되어 있어야 한다.](https://docs.aws.amazon.com/sdk-for-java/v1/developer-guide/setup-credentials.html) default profile로 설정이 되어있다면 고민할 필요가 없고 만약 multiple profile을 관리하고 있다면 `AWS_PROFILE` environment variable을 적절하게 사용해주거나 앞으로 `sls`를 사용할 때 `--aws-profile PROFILE-NAME`을 사용하면 된다. 단, 후자의 경우 한 번이라도 실수하면 좋지 못한 상황이 벌어지기 때문에 가급적이면 `AWS_PROFILE` 등의 environment variable을 설정해서 사용하는 것을 권장하고 이를 위해 [`direnv`](https://github.com/direnv/direnv) 등을 사용하면 더욱 좋다고 생각한다.

`sls deploy` 명령으로 다음과 같이 배포할 수 있다. 그럼 Webpack을 진행하여 code를 packing한 후 zip으로 만들어서 S3에 올려 Lambda에 연결한 후, API Gateway, Lambda, CloudWatch, DynamoDB 등의 자원을 관리하는 CloudFormation stack을 만들어 시스템 배포를 진행하게 된다.

```bash
$ sls deploy
Service Information
service: websocket-chat
stage: dev
region: us-east-1
stack: websocket-chat-dev
resources: 24
api keys:
  None
endpoints:
  wss://API-ID.execute-api.us-east-1.amazonaws.com/dev
functions:
  connect: websocket-chat-dev-connect
  disconnect: websocket-chat-dev-disconnect
  broadcast: websocket-chat-dev-broadcast
layers:
  None
```

테스트를 할 때에는 [`wscat`](https://github.com/websockets/wscat)이 좋다. `npm i -g wscat`으로 설치하고, 터미널을 여러 개 띄워서 다음과 같이 테스트할 수 있다.

```bash
$ wscat -c "wss://API-ID.execute-api.us-east-1.amazonaws.com/dev"
connected (press CTRL+C to quit)
> hi there!
< hi there!
disconnected (code: 1001)
```

이 시스템은 아직 제대로 된 모니터링이나 보안 대책을 가지고 있지 않기 때문에 주소를 public하게 노출했다가는 다른 사람들의 놀이터가 되기 쉬우므로 주의가 필요하다. 일단은 기본기를 연습한다는 느낌이면 좋을 것 같고, 이로써 AWS Serverless 기반의 WebSocket 서버 구축을 완료하였다.

#### 한계 및 응용

WebSocket API가 dedicated 서버에 비해 비용이 아주 효율적이지는 않다. 왜냐하면 connect, disconnect, default 혹은 custom routeKey에 의해 수행되는 API call 비용과 그에 따른 Lambda 수행 비용, DynamoDB 요청 비용 등이 지속적으로 발생할 수 있고, 무엇보다도 이 WebSocket API는 connection 유지 비용이 있어 connection이 연결되어 있는 시간의 초 단위에 비례해서 매겨지는 요금이 있다. 그마저도 10분 동안 아무런 요청이 없으면 자동으로 연결을 닫고, 요청이 계속 있다고 해도 2시간이 넘어가면 연결이 끊어지게 된다. 뿐만 아니라 payload에도 제한이 있어 한 frame의 크기가 32KB가 넘어갈 수 없고 binary frame을 사용할 수도 없다. 마지막으로 이미 연결을 맺는 과정(`$connect`)에서는 클라이언트의 연결을 거부할 수 있지만 이미 맺어진 후에 클라이언트와의 연결을 강제로 종료하는 API가 존재하지 않는다.

동시 연결 수 등의 다른 제한 요소들도 있으므로 만약 이를 production에서 사용하고자 한다면 [Limitations](https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html)를 확인하는 것이 꼭 필요하다. 게다가 어떤 제한은 ticket을 통해 증가시킬 수도 있지만 그렇지 못한 값도 있으므로 반드시 먼저 확인을 해야 한다.

그럼에도 불구하고 WebSocket API는 꽤나 Serverless라는 점에서, 즉 managed resource라는 점에서 매력적이다. dedicated resource처럼 할당한 시간 동안 돈을 내지 않아도 되므로 가끔 잠깐씩 요청이 많아질 수 있는 가벼운 서비스에서는 큰 기술없이 저렴한 비용으로 튼튼한 backend를 구축하기에 훌륭한 도구이다.

예를 들어 잉여톤에서 게임 mock up을 위해 가끔은 이런 클라이언트 간의 broadcasting 서비스가 필요할 때가 있는데 그 때마다 서버를 새로 만들어 띄우는 것은 너무 번거롭고, 그렇다고 계속 띄워놓자니 비용이 아무래도 아깝다. 이러한 경우를 위해 만든 [`message-broadcast`](https://github.com/yingyeothon/message-broadcast) 서비스는 어느 정도 수준에서의 production 게임 내 채팅 서버로 써도 괜찮고, topic 별로 broadcasting이 가능한 [`message-topic`](https://github.com/yingyeothon/message-topic) 도 정리하고 있다. 이후 차츰 더 많은 부분을 Serverless 기반으로 재사용 가능하게 정리하여 저렴한 비용의 backend를 작성할 수 있도록 고민해볼 예정이다.

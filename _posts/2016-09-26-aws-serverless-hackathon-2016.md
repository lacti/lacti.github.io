---
layout: post
title: aws serverless hackathon 2016
tags: aws serverless
published: true
---

작년에 참가하지 못했던 [serverless gaming on aws](https://aws.amazon.com/ko/events/gaming-on-aws/seoul-02/hackathon/)을 올해는 드디어 참가할 수가 있었다. 개인적으로 행사에 대한 참가 소회를 생생하게 밝힐 자신은 없으므로 같이 참가했던 분의 글을 소개하는 것으로 넘어가려고 한다.

- [2015년: Serverless 실시간 대전게임](http://hyunjong-lee.github.io/tech/2015/09/16/AWS-Lambda-Serverless-Turn-Game.html)
-  [2016년: Gaming on AWS Hackathon 참가 후기](http://hyunjong-lee.github.io/tech/2016/09/25/Gaming-on-AWS-Hackathon-2nd.html)

### game-server-less

나는 game programming에 있어서 unity가 기여한 바가 크다고 생각한다. device context를 어떻게 초기화하고, message loop를 어떻게 만들며 asset을 어떻게 연결하고 이를 어떻게 rendering할 것인지 크게 고민하지 않고 오로지 게임 구현에만 집중할 수 있는 기반을 만들어주었다고 생각하기 때문이다.

클라이언트 개발은 전혀-_- 모르고 서버 개발만 해온 사람으로 게임 서버 쪽에 이러한 framework이 없다는 것은 굉장히 아쉬웠다. 게임 서버를 구현할 때 게임 로직에 집중을 한다기 보다는 어떻게 message를 교환할 것이며 어떻게 persistency를 유지할 것이며 어떻게하면 성능을 빠르게 할 것인지 고민하는데에 시간을 더 많이 쓰는 것 같아서였다.

단순히 네트워크가 되는 게임을 만들고 싶은데 신경써야 할 것이 너무 많다고 생각했다. 심지어 클라이언트가 모든 로직을 처리하고 그들 간의 메시지만 교환하려고 해도 고려할게 너무 많다고 생각했다. 그런 것들을 전혀 몰라도 게임을 만들면 참 좋을텐데.

그래서 어떻게든 게임 서버를 만들지 않고도 게임 서버를 구축하는(?) 방법이 있으면 참 좋겠다고 생각했다.

### aws serverless

그러던 와중에 aws에서 web service에 대해서는 serverless를 쉽게 만들 수 있는 방법이 제안되었다. [api gateway](https://aws.amazon.com/lambda/)와 [lambda](https://aws.amazon.com/lambda/)로 url endpoint에 대해 어떤 동작을 처리할 지에 대해 [함수 수준으로 명시](http://martinfowler.com/articles/serverless.html)할 수 있게 되었고 이를 [놀라운 도구: chalice](https://github.com/awslabs/chalice)를 통해서 간편하게 개발할 수 있게 해주었다.

이제 restful api는 flask 기반의 서버 코드를 만들고 deploy만 해서 serverless한 service 구축이 가능해졌다.

### serverless game

하지만 restful api로 game을 만드는 것은 쉽지 않다. 현재 aws에 의해 제시되는 기능을 이용해 쉽게 만들 수 있는 부분은,

- 게임을 모두 클라이언트에서 처리한 후 그 결과를 서버에 잠깐 저장하기 위해 사용한다든가,
- cognito를 사용해 기기 인식과 인증을 다룬다거나,
- mobile analytics을 사용해서 사용 패턴을 분석하거나

하는 부분이라고 생각했다. 물론 이 부분도 굉장히 중요한 부분이라고 생각하지만, 아무래도 출신이 mmo 개발자여서 그런지 실시간 통신에 더 눈이 갔다-_-;

#### 2015

실시간 통신을 위해 server push가 필요했고 이를 위해 [server event](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)를 사용할 지, 아니면 long polling을 사용할지 고민했다. 일단는 [sqs](https://aws.amazon.com/sqs/)를 사용해서 long polling을 하는 것을 사용했고, 그 결과 latency에 의해 턴제 수준의 게임을 만드는 정도 밖에 할 수 없었다.
그리고 sqs는 굉장히 훌륭한 distributed queue이기 때문에 [순서가 보장되지 않을 수 있었다](https://aws.amazon.com/articles/Amazon-SQS/1343#03). 그리고 이 현상은 실제로 이를 통해 게임을 구현한 분들이 확인했다.

뭔가 더 나은 메시지 교환 모듈이 필요했다. 

#### 2016

game의 lobby 부분은 충분히 restful하게 만들 수 있다. 그리고 이는 chalice에 의해 해결되었다. 이제는 low latency, preserve order을 지원하는 실시간 통신 부분만 남았다.

간단히 mo 게임에 대해 다음과 같이 시스템 구성도를 그렸다.

1. 방(게임 한 판)이 만들어질 때 message queue를 생성한다.
2. 생성된 queue를 client가 모두 연결한다. 그리고 message가 들어오면 실시간으로 빼내어 처리한다.
3. 해당 queue에 client 요청을 server가 적절히 처리하여 client queue에게 message를 전달한다.
4. 게임이 완료되면 queue를 제거한다.

위 과정을 수행하기 위해서는 server와 client가 직접 연결하여 message를 교환할 수 있는 low latency의 message broker가 필요했다. 이걸 직접 만들어야 될까 고민할 때 운 좋게 [다음의 예제](https://github.com/rabbitmq/rabbitmq-web-stomp-examples)를 찾았다.
rabbitmq의 websocket 예제인데 ec2의 nano instance에서 돌려봐도 message 교환 latency가 10ms 수준이 될 정도로 성능이 꽤 괜찮게 나왔다.

간단한 게임이 기획되었고, 시스템은 다음과 같이 설계되었다.

1. client를 시작하면 모든 client가 지정된 rabbitmq의 topic에 subscribe하고, server queue에 연결한다. (by [stomp](https://github.com/jasonrbriggs/stomp.py)) 
2. client가 server queue에 message를 넣으면, 이 queue를 대기하고 있는 [recurring lambda](http://theburningmonk.com/2016/04/aws-lambda-use-recursive-function-to-process-sqs-messages-part-1/)가 그 message에 대응되는 handler를 수행한다.
3. 2)의 handler 결과를 client topic에 publish한다. 이제 client들은 client topic으로부터 message를 수신할 수 있다.

시간상 '한 판'의 개념이 존재하는 mo 형태의 게임이 아니라 mmo 형태의 게임이 되면서 2)에서 수행되는 lambda가 사실상 server의 역할을 하였지만, 다음의 부분에서 serverless로의 의의를 갖을 수 있다고 생각했다.

- 게임이 시작할 때마다 queue를 생성하고 이를 client들과 공유한다. 그리고 client로부터 전달된 message를 처리하는 lambda들이 게임이 생성될 때마다 실행된다. 때문에 서버 머신이라는 자원의 제약없이 pay as you go 개념에 맞는 요금 모델로 게임을 서비스할 수 있다.
- queue를 통해 message를 받고, 그 queue에 대기하여 message를 처리하기 때문에, *이론적으로* 이 queue를 처리하는 lambda가 죽었을 경우 해당 lambda를 재빠르게 다시 시작하면 SPOF도 없어질 수 있을 것 같다.
- 만약 그렇지 않다고 해도 마치 web service처럼, 모든 게임 서버 로직이 방마다 분리되어 수행되므로 게임 서버를 갱신하고자 할 때 모든 게임의 종료가 필요없이 이후부터 실행되는 게임만 갱신할 수도 있다. 즉, 무중단 게임 업데이트가 가능할 것 같다.

어쨌든 이번엔 message broker를 이용해 low-latency로 message 교환이 가능하다는 것으로 poc는 훌륭히 끝났다.

### 마무리

쓸데없이 말이 길어졌는데 요약하면 다음과 같다.

- aws에서 low-latency, preserve-order의 message broker 서비스를 지원해주었으면 좋겠다.

저 broker를 통해 server와 client가 필요할 때마다 queue를 할당해서 message를 교환하고, server는 queue에 진입하는 message마다의 handler를 작성해서 처리하는 로직만 작성하면 되니까.

chalice가 restapi를 작성해서 deploy하면 apigw, lambda로 서비스를 구축해주는 것처럼, queue policy와 message handler를 작성해서 deploy하면 실시간 통신이 가능한 서버를 손쉽게 만들 수 있는 framework도 개발이 가능하지 않을까 싶다.

그러면 정말 다음과 같이 server의 기능을 구현하면 게임 서버가 구축될 수 있지 않을까. 

```python
@app.route("/user/items")
def lobby_get_items():
    # some restful logics

@msg.route("/type=move")
def game_move():
    # some realtime logics
```

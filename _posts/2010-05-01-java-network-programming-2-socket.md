---
layout: post
title: 자바 네트워크 프로그래밍 2 - Socket
tags: java -pub
---

자바 네트워크 프로그래밍을 설명하려면 당연히 IO부터 이야기해야하는 것이 맞겠지만 이왕 저지른거 막장으로 달려보자.

### Socket ###

전 글에서 네트워크 통신을 사람 간의 전화로 비유했었다.  
네트워크 통신을 한다는 것은 [NIC(Network Interface Controller)](http://en.wikipedia.org/wiki/Network_Interface_Controller)를 사용하여 데이터를 주고 받겠다는 것이고 이는 **하드웨어를 제어해야 한다는 뜻이다.** 하드웨어는  **운영체제가 관리하고 있는 자원**이기 때문에 일반 프로그램들이 접근할 수 없다.

처음 c/c++ 배울 때 사용했떤 파일 읽기/쓰기도 **하드디스크**라는 하드웨어 자원을 쓰는데 잘은 몰랐지만 프로그램이 제어를 했었다. 그 이유는 ~~모르는 사이에~~ open, read, write와 같은 **운영체제가 제공하는 API**를 사용했기 때문이다. 요약하자면, **하드웨어 자원은 운영체제가 관리하니 운영체제가 제공하는 API를 사용하여 프로그래밍을 해야 한다**는 것이다.

고로 네트워크 프로그래밍을 하기 위해 운영체제가 주는 API가 있는데 그것이 바로 **소켓:Socket**이라고 보면 되겠다.  
<span style="color: #aaa;">짧은 지식으로는 더 잘 설명할 재간이 없으니 [...] 그냥 그렇다고 넘어가자.</span>

코드 한 줄 없이 이렇게 장문을 쓰는 것도 괴로운 일이므로 바로 코드로 넘어가보자.

### Client ###

클라이언트는 요청하는 쪽이다. 서버를 끊임없이 괴롭혀서 자신이 원하는 정보를 받아가는 녀석이다.  
대표적인 예로 웹이 있다. 지금도 웹 서버에게 웹 페이지 데이터를 받아서 읽고 있는 것이다.

클라이언트가 **TCP/IP** 데이터 통신을 하기 위한 순서는 다음과 같다.

1. Socket을 만든다.
2. 생성된 Socket으로 서버와 연결한다
3. 신나게 데이터 통신을 한다.
4. 연결을 종료한다.

말은 길고 코드는 짧으니 바로 코드로 넘어가보자.

```java
import java.io.IOException;
import java.io.InputStream;
import java.net.Socket;
import java.net.UnknownHostException;

public class Client {
	public static void main(String[] args) throws UnknownHostException, IOException {
		Socket socket = new Socket("127.0.0.1", 3112); // 소켓 생성과 동시에 연결
		InputStream inStream = socket.getInputStream(); // 데이터 수신을 위한 InputStream 가져오기
		byte[] chunk = new byte[4096]; // 데이터를 받을 byte 배열 생성
		int receiveLength = inStream.read(chunk); // 데이터를 읽고, 얼마나 가져왔는지를 반환받음
		System.out.println(new String(chunk, 0, receiveLength)); // 수신받은 데이터를 콘솔에 출력
		inStream.close(); // InputStream을 닫음
		socket.close(); // 소켓을 닫음
	}
}
```

* 소켓 생성과 동시에 연결(connect)를 할 수 있다.
	* 물론 소켓 생성 후에 connect 함수를 통해서도 접속 가능하다.
	* 이 때 첫 번째 인자가 연결할 서버의 **hostname 혹은 ip address**이고 두 번째 인자가 **port 번호**이다.
* 연결 후 데이터 통신을 위한 **InputStream**과 **OutputStream**을 가져와 통신할 수 있다.
* 통신이 끝난 후 스트림과 소켓을 **닫아주면** 된다.
	* 효율적인 자원관리를 위해 **다 쓴 자원은 꼭 주자.**

위 예제에서는 예외처리를 제대로 하지 않고 밖으로 다 던져**throws**버렸는데 실제 코드를 작성할 때에는 반드시 수행하는 하나하나에 대해 적절한 예외처리를 해주어야 한다.

### Server ###

서버는 응답자라고 보시면 되겠다. 클라이언트의 요청에 대한 결과물을 회신하는 쪽이다.  
이는 웹 서버가 열심히 웹 페이지를 보내주고 있는 것으로 생각하시면 되겠다.

서버가 **TCP/IP** 데이터 통신을 하기 위한 순서는 다음과 같다.

1. ServerSocket을 만든다.
2. 클라이언트의 연결 요청에 대해 accept를 하여 클라이언트와 데이터 통신을 수행할 Socket 객체를 만든다.
3. 신나게 데이터 통신을 한다.
4. 연결을 종료한다.

바로 코드로 넘어가보자.

서버는 클라이언트로부터의 연결을 계속 기다리고 있다. 단, 클라이언트가 어떤 **PORT 번호**로 접속해야 할지를 알고 그 PORT에 달라붙어서(**bind**) 기다리고(**listen**) 있으면 된다. 그리고 클라이언트가 접속하면, 해당 클라이언트에 대한 소켓을 낚으면(**accpet**) 된다.

```java
import java.io.IOException;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;

public class Server {
	public static void main(String[] args) throws IOException {
		ServerSocket server = new ServerSocket(3112); // PORT를 열고 접속을 대기
		Socket socket = server.accept(); // 클라이언트의 연결로부터 소켓을 만듬
		OutputStream outStream = socket.getOutputStream(); // OuputStream을 얻음
		outStream.write("Hello Java Network Programming World!".getBytes()); // 클라이언트에게 환영 인사를 보냄
		outStream.close(); // OutputStream을 닫음
		socket.close(); // 클라이언트와의 연결 소켓을 닫음
		server.close(); // 클라이언트 접속 대기 소켓을 닫음
	}
}
```

서버는 클라이언트와 다르게 두 개의 소켓 개념이 존재한다. 하나는 **서버소켓**이고, 하나는 **클라이언트와 데이터 통신을 수행하기 위한 소켓**이다.

* **서버소켓**은 **클라이언트가 접속하는 것을 대기하는 소켓**이다. 따라서 클라이언트가 접속할 PORT 번호에서 **대기(bind, listen)**하고, 클라이언트가 연결을 요청할 때 **수락(accept)**하여 해당 클라이언트와 데이터 통신을 하기 위한 소켓을 만들어준다.
* 그렇게 만든 소켓을 사용하여 방금 연결된 클라이언트와 데이터 통신을 할 수 있는데, 이 때 소켓의 사용 방법은 클라이언트 때와 동일합니다.

위의 두 예제를 실행하면, 서버가 클라이언트의 접속을 기다리고 있다가 클라이언트가 접속하면 "Hello Java Network Programming World!"라는 문자열을 보내고, 클라이언트가 이를 받아 console에 출력한 뒤 끝나는 결과를 볼 수 있다.

### 결론 ###

쓰다보니 필요한 많은 개념들을 대충대충 넘어갔다.  
특히 중요한 blocking 개념을 설명하지 않고 넘어가다 보니 피상적으로 코드를 읽어주는 글이 되어버려서 아쉽다.

따라서 다음 글에서는 io의 blocking과 이를 해결하기 위한 multi-thread programming에 대해 간략히 알아보도록 하자.
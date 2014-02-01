---
layout: post
title: 분산 처리 환경 구현 3
tags: distributed c# rpc -pub
---

* [Github: DistWork - simpler](https://github.com/lacti/DistWork/tree/simpler)

지난 글에서 예고한 RpcWork와 Dll 전달 방법에 대해 알아보자.  
*(원래는 WorkGroup까지 보려고 했는데 자세한 구현은 귀찮으니 나중에 기회가 되면 쓰도록 하겠다)*

### RPC 구현 ###

`RpcWork`는 다음의 방법으로 쉽게 구현할 수 있다.

```csharp
[Serializable]
public abstract class RpcWork<TReturn> : IWork
{
    [Serializable]
    private class ReturnWork : IWork
    {
        private readonly RpcWork<TReturn> _parentWork;
        private readonly TReturn _returnValue;

        public ReturnWork(RpcWork<TReturn> parentWork, TReturn returnValue)
        {
            _parentWork = parentWork;
            _returnValue = returnValue;
        }

        public void Execute(Socket endPoint)
        {
            _parentWork.ExecuteReturn(_returnValue, endPoint);
        }
    }

    public void Execute(Socket endPoint)
    {
        var returnValue = ExecuteWork(endPoint);
        endPoint.SendWork(new ReturnWork(this, returnValue));
    }

    protected abstract TReturn ExecuteWork(Socket endPoint);
    protected abstract void ExecuteReturn(TReturn returnValue, Socket endPoint);
}
```

원격지에서 수행할 함수를 담는 `RpcWork` class와 그 수행 결과를 담아 다시 돌려줄 `ReturnWork` class로 구성되어 있다. `RpcWork`의 `ExecuteWork()` 함수가 원격지에서 수행될 함수이고, `ExecuteReturn()` 함수가 원격지에서 수행된 결과를 받아서 처리할 함수이다.

* `RpcWork`의 `Execute()` 함수는 원격지에서 수행된다. 수행에 필요한 정보는 `RpcWork`를 상속받는 class의 멤버 변수로 가지고 있을테니 잘 serialize 되어서 전달될 것이다.
* `Execute()` 함수는 `ExecuteWork()` 함수를 수행해서 그 결과를 받은 뒤, `endPointSocket`에게 그 결과를 `ReturnWork` class에 담아 전달하게 된다.

이 때 재미있는 것은 `ReturnWork` 객체의 생성자로 `RpcWork`를 받는다는 것이다. 그 이유는 `ReturnWork`의 `Execute()` 함수에서 `RpcWork` 객체의 `ExecuteReturn()` 함수를 불러주기 위함이다. 즉 처음 Rpc를 요청한 호출자가 `ReturnWork` 객체를 받아서 `Execute()` 함수를 수행하면, `ReturnWork` 객체는 멤버로 가지고 있는 `RpcWork` 객체의 `ExecuteReturn()` 함수를 불러준다는 뜻이다.

결국 호출자가 대상자에게 Rpc를 요청할 때 보냈던 `RpcWork` 객체와 실제 결과가 도착한 뒤에 `ExecuteReturn()` 함수가 불리는 `RpcWork` 객체는 **전혀 다른 객체**라는 뜻이다. 다만 처음 보냈던 `RpcWork` 객체의 모든 context (멤버 변수)가 그대로 대상자에게 전달되었다가, 고스란히 호출자에게 다시 전달되다 보니 같은 객체인 것처럼 보이는 것이다.  
(**Equals() == true이지만 ReferenceEquals() == false인 것**이다.)

뭐 위처럼 만들면 Master와 Slave가 주고 받을 데이터의 양이 많아지니 네트워크 IO 비용에서는 좋지 않을 수 있다. 그래도 Master/Slave를 만드는 입장에서는 요청에 대한 응답을 기다리기 위한 context 유지 코딩을 안해줘도 되니 편하다.  
<span style="color: #aaa;">마치 stateless한 http처럼, a+b+c 좀 계산해줄래 slave야? a+b+c 계산해달라던 master야, 결과는 이거다! 하는 느낌</span>

### RPC 예제 ###

간단한 덧셈 Rpc를 구현해보면 다음과 같다.

```csharp
[Serializable]
public class RemoteSumWork : RpcWork<int>
{
    private readonly int _leftValue;
    private readonly int _rightValue;

    public RemoteSumWork(int left, int right)
    {
        _leftValue = left;
        _rightValue = right;
    }

    protected override int ExecuteWork(Socket endPoint)
    {
        return _leftValue + _rightValue;
    }

    protected override void ExecuteReturn(int returnValue, Socket endPoint)
    {
        Console.WriteLine("Return from: " + returnValue);
    }
}
```

두 인자를 생성자로 받아 멤버로 저장한다. `ExecuteWork()` 함수에서는 멤버의 두 값을 더해서 반환하고, `ExecuteReturn()` 함수에서는 인자로 그 결과를 받아서 화면에 출력한다.

```csharp
master.DistributeWork(new RemoteSumWork(100, 200));
```

`RemoteSumWork`의 `ExecuteReturn()` 함수가 수행될 때, `_leftValue`와 `_rightValue` 값은 master에서 slave로 요청할 때 한 번, slave에서 master로 `ReturnWork` 보낼 때 다시 묻어서 한 번, 총 두 번 network trip을 하게 된다.

**결과는 4Bytes(int)인데 context 유지를 위해 무려 12Bytes를 받다니!** 그런데 class를 `BinaryFormatter`로 serialize하는 이상 이미 type 정보 같은 것들 때문에 더 큰 bytes가 소모되고 있다-_-;

### 코드 분리 ###

이제 Master와 Slave가 코드를 공유하지 않는 형태를 구현해보자.
Master에서 Slave에게 수행시키고 싶은 함수가 있는데 Slave에게는 아쉽게도 코드가 없다. 이 문제를 해결하기 위해서는 Slave에게 시키고 싶은 코드를 Dll에 담아서 Slave에게 전달해주면 된다.

첨부된 소스를 보면 이 예제를 쉽게 확인할 수 있도록 프로젝트를 잘게 쪼개놨다.

* `DistWork`는 분산 처리 관련 모듈이 들어있는 Library Project이고,
* `DistMaster`와 `DistSlave`는 각각 Master/Slave 객체 하나씩 만들어서 프로그램 수행하는 `Main()`을 포함한 Console Project이다.
* 그리고 `DistFunctions`가 Master로부터 Slave에게 공유될 소스 코드가 담긴 Library Project이다.

결국 `DistFunctions`로부터 만들어지는 *DistFunctions.dll*를 Slave에게 전달해주면, Master가 보내는 코드도 Slave가 잘 실행해줄 수 있다는 것이다.

일단 파일을 보내기 위한 Work부터 만들어보자.

```csharp
[Serializable]
public class FileSendWork : IWork
{
    private readonly string _fileName;
    private readonly byte[] _fileBytes;

    public FileSendWork(string filePath)
    {
        _fileName = Path.GetFileName(filePath);
        _fileBytes = File.ReadAllBytes(filePath);
    }

    public void Execute(Socket endPoint)
    {
        if (File.Exists(_fileName))
            return;

        using (
            var stream = new FileStream(_fileName, FileMode.CreateNew,
                                        FileAccess.Write, FileShare.Write))
        {
            stream.Write(_fileBytes, 0, _fileBytes.Length);
        }
    }
}
```

파일 이름은 서버가 지정해준대로 사용한다. 만약 동일한 파일 이름이 이미 Slave에 있다면 파일을 저장하지 않는다**(!)**

자세한 설명은 잠시 뒤에 하고, Master와 Slave가 어떤 코드를 갖는지 보자.

[*DistMaster/Program.cs*](https://github.com/lacti/DistWork/blob/simpler/DistMaster/Program.cs#L25-L26)

```csharp
master.DistributeWork(new FileSendWork("DistFunctions.dll"));
master.DistributeWork(new RemoteSumWork(100, 200));
```

[*DistSlave/Program.cs*](https://github.com/lacti/DistWork/blob/simpler/DistSlave/Program.cs#L12-L16)

```csharp
var slave = new Slave("127.0.0.1", 12345);
Task.Factory.StartNew(slave.Start);

Logger.Write("Slave Start!");
Console.ReadKey();
```

Slave 프로젝트는 DistFunctions 프로젝트를 Reference로 등록해놓지 않았기 때문에 `RemoteSumWork` 클래스의 존재를 모른다. 따라서 Master가 `RemoteSumWork` 객체를 보내면 deserialize 과정에서 Type 객체를 찾을 수 없다고 예외가 발생해야 한다.

하지만 그 `RemoteSumWork` 객체를 보내기 전에 `DistFunctions.dll`을 보냈다. Slave는 이 파일을 받아서 **자신의 exe 파일이 있는 위치에 저장하게 된다.** 덕분에 `RemoteSumWork` 객체를 전달받았을 때에는 **exe 주변의 dll을 알아서 검색해서 알아서 deserialize를 해준다.** 즉, dll만 보내주면 끝이라는 이야기이다.

물론 DistFunctions.dll 파일의 버전이 올라갈 경우에 대해서는 신경을 좀 써줘야 한다.

* 예전에 보낸 DistFunctions.dll은 이미 Slave에 load된 상태이기 때문에 삭제를 하거나 덮어쓰는 등의 작업을 할 수 없다. (이미 사용 중인 파일이라고 나온다)
* 때문에 WinSxS처럼 버전 별로 dll을 쌓아놓는 방법을 쓰면서 Slave가 재시작될 때 적절히 Dll 파일들을 삭제해주는 정책을 쓰면 되겠다.

단, *여러 버전의 Dll 파일을 사용*하려면 위처럼 **보내기만 하면 자동으로 Assembly에 포함되는** 기법을 사용할 수가 없다. 따라서 Slave에게 작업 요청할 때 이 Work 객체가 어떤 Dll 밑의 Assembly에 포함되어 있는지를 명시해주어 serialize할 때마다 적절한 Assembly를 참조할 수 있도록 코딩해줘야 한다. `Assembly.LoadFile(Path.GetFullName(...)).GetType(...)` 같은 작업을 해줘야 하는데 이 부분을 설명하려면 내용이 굉장히 길어지니 추후 기회가 있으면 언급해보도록 하겠다.

### 정리 ###

요새 이것 저것 바빠서 글을 못 썼다기 보다는 다른 재밌는 주제가 많아지다 보니 이 주제에 대한 흥미가 많이 떨어져버렸다-_-;  
이러다간 영영 못 쓸 것 같아서 고민하고 있다가, 이 글을 완료하지 못하면 다음 주제로 넘어갈 수가 없으니(orz) 대충이라도 끝을 내야겠다싶어 급하게 글을 끝내버렸다.

솔직히 좀 많이 아쉬운 주제인데 나중에 기회가 되면 또 도전해보고 싶다 [...]

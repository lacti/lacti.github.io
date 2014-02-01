---
layout: post
title: 분산 처리 환경 구현 2
tags: distributed c# -pub
---

* [Github: DistWork - simplest](https://github.com/lacti/DistWork/tree/simplest)

지난 번 글에서는 분산 처리 환경에 대한 구조를 대충 알아봤다. 이번 글에서는 대충 알아본 것 중 하나를 선택해서 C#으로 구현을 해볼 것이다.

가장 간단해보이는 M-S 모델 (master-slave)을 C#으로 구현해보자.

일단 구현하기에 앞서 간단히 설계도를 살펴보자.

![구현 설계도]({{site.url}}/images/mdf_arch.png)

master에는 여러 slave가 연결한다. 각 연결된 slave는 master 내에 어떤 작업을 수행하는지/했는지 info를 갖는다. master에 command가 들어오면 수행할 work를 만든다. 연결된 slave의 info를 살펴보고 적절한 slave를 선택한 후 work를 보내준다**(distribute)**. 그러면 slave는 그 작업을 처리하고 결과를 master에게 보내주던가 한다.

위 구현을 위해서는,

* c# network programming 기술
* c# object serialization 기술

정도만 알면 된다.

하지만 본 글에서 위 내용을 설명하는 것은 매우 무의미하기 때문에 이 부분에 대해서는 설명하지 않는다. 자세한 내용은 [소스 코드](https://github.com/lacti/DistWork/tree/simplest)의 [AsyncSocketExtension.cs](https://github.com/lacti/DistWork/blob/simplest/DistWork/Util/AsyncSocketExtension.cs)와 [WorkSocketHelper.cs](https://github.com/lacti/DistWork/blob/simplest/DistWork/Core/WorkSocketHelper.cs) 파일을 보면 된다.

### 구현 ###

먼저 master와 slave가 주고 받을 작업의 추상 형태인 IWork interface부터 살펴보면 다음과 같다.

```csharp
public interface IWork
{
    void Execute(Socket endPoint);
}
```

이 interface를 구현한 class가 Serializable하면 Master와 Slave간에 serialize/deserialize되어 전달될 수 있고, 전달된 후에 `Execute`를 호출해주면 되므로 사실상 RPC와 같은 형태가 된다. 이 때 `endPoint`의 Socket을 받는 이유는 수행한 결과에 대해 상대측으로 다시 결과를 전달하기 위함이다. (이는 마지막 예제에서 볼 수 있다.)

`Master` class는 `Slave`의 통신을 위한 `Socket`과, 각 `Slave`의 상태에 대한 Information을 갖는다. 그리고 작업 분산이 요청될 경우(`DistributeWork`) 적절한 `Slave`의 `Socket`을 고르기 위한 알고리즘 함수를 갖는다. Java같은 언어라면 interface로 해당 알고리즘을 분리하겠지만, C#이니 그냥 delegate로 빼서 관리한다.

위 구현 사항을 분할해서 살펴보자. 먼저 Slave와 연결을 맺고 Slave가 전달하는 Work를 처리하기 위한 함수이다.

```csharp
// Master class
public async void Start()
{
    var listener = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
    var localEndPoint = new IPEndPoint(IPAddress.Any, _port);
    try
    {
        listener.Bind(localEndPoint);
        listener.Listen(100);
        while (true)
        {
            var clientSocket = await listener.AcceptAsync();
            ProcessSocket(clientSocket);
        }
    }
    catch (Exception e) { Logger.Write(e); }
}

private async void ProcessSocket(Socket socket)
{
    _container.AddSocket(socket);

    Logger.Write("Connected from: " + socket.RemoteEndPoint);
    try
    {
        while (true)
        {
            var work = await socket.ReceiveWork();
            work.Execute(socket);
        }
    }
    catch (Exception e) { Logger.Write(e); }

    try { socket.Shutdown(SocketShutdown.Both); }
    catch { }
    _container.RemoveSocket(socket);
}
```

지정된 port에 bind된 socket이 `Slave`와 연결되면 그 `Socket`으로부터 `Work`를 하나씩 받아서(deserialize) 처리하는 형태이다. awaitable한 프로그램을 작성했기 때문에 managed thread pool이 적절히 잘 운영해준다.

`_container`는 `SocketContainer` 객체로 slave의 socket을 관리해준다. `SocketContainer`에서 관리하는 Socket 집합은 추후 작업을 분산시키기 위해 특정 slave를 선택할 때 사용된다.

`Slave`는 `Master`에 연결한 뒤, 역시 동일하게 `Master`로부터 `Work`를 받아서 처리하는 구조로 작성하면 된다. 때문에 이 부분은 `Master`의 코드와 크게 차이가 없다.

```csharp
public class Slave
{
    public async void Start()
    {
        try
        {
            var socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream,
                    ProtocolType.Tcp);
            socket.Connect(_host, _port);
            while (true)
            {
                var work = await socket.ReceiveWork();
                work.Execute(socket);
            }
        }
        catch (Exception e) { Logger.Write(e); }
    }
}
```

`Slave`의 `Socket`을 관리하는 `SocketContainer`는 `Slave`의 연결이 동시 다발적으로 일어나므로 내부에 Lock을 가지고 Container를 관리하는 객체이다.

```csharp
// SocketContainer class
ReaderWriterLockSlim _lock =
    new ReaderWriterLockSlim(LockRecursionPolicy.SupportsRecursion);
private readonly Dictionary<Socket, SocketInformation> _sockets =
    new Dictionary<Socket, SocketInformation>();

public void AddSocket(Socket socket)
{
    _lock.DoWriteLock(() => _sockets.Add(socket, SocketInformation.Invalid));
}

public void RemoveSocket(Socket socket)
{
    _lock.DoWriteLock(() => _sockets.Remove(socket));
}

public Socket SelectSocket(Func<List<KeyValuePair<Socket, SocketInformation>>, Socket> selector)
{
    return _lock.DoReadLock(() => selector(_sockets.ToList()));
}
```

약간이나마 효율을 높이기 위해 `ReaderWriterLock`을 사용했다.
재미있는 부분은 `SelectSocket`을 수행하는 부분인데, 이 과정에서는 모든 `Socket`과 그에 대한 `SocketInformation`을 순회하면서 적절한 `Socket`을 뽑아내야한다. 하지만 해당 자료구조를 순회하려면 자료구조가 Lock으로 보호된 상태이어야 하므로 Socket을 선택하는 selector를 delegator 형태로 받아서 `ReadLock` 구간 내에서 수행될 수 있도록 한다.

그런데 작업을 분산시키기 위해 필요한 정보는 `Socket`, `SocketInformation` 뿐만 아니라 어떤 작업인지(`IWork`)의 정보도 필요하다. 때문에 `Master`에서는 이 정보까지 취합해서 적절한 `Slave`를 선택할 수 있도록 delegator를 제공한다.

```csharp
public sealed class DistributeContext
{
    public readonly IList<KeyValuePair<Socket, SocketInformation>> Sockets;
    public readonly IWork Work;
    private readonly SocketContainer _container;
```

필요한 정보(`Socket`, `SocketInformation`, `IWork`)를 `DistributeContext`로 감싸서 `SelectSocketDecl`로 넘겨준다. 이 delegator는 `_container`의 `SelectSocket()` 내에서 수행되므로 `_container`의 ReadLock 내에서 수행된다. 이렇게 socket을 하나 선택하게 되면 해당 socket으로 work를 전달한다. 즉 해당 slave에게 work를 전달한다.

```csharp
// Master class
public delegate Socket SelectSocketDecl(DistributeContext context);
private SelectSocketDecl _socketSelector;
public void DistributeWork(IWork work)
{
    var socket = _container.SelectSocket(sockets =>
            _socketSelector(new DistributeContext(_container, sockets.AsReadOnly(), work)));
    if (socket == null)
        throw new NullReferenceException();

    socket.SendWork(work);
}
```


굉장히 간단한 구조로 분산 시스템을 만들어봤다.

* Master는 Slave의 연결을 기다리고, Slave가 연결되면 각 상태를 적절하게 고려해서 작업을 전달한다.
* Slave는 Master에게 연결한 뒤, Master의 작업을 기다리고 있다가 받는 즉시 처리해준다.

### 예제 ###

소스 코드에 첨부된 간단한 예제 코드를 직접 보면 다음과 같다.

```csharp
[Serializable]
internal class SlaveWork : IWork
{
    public void Execute(Socket endPoint)
    {
        Console.WriteLine("Do my work: " + endPoint.RemoteEndPoint);
        endPoint.SendWork(new MasterWork(new SlaveResult("TEST MESSAGE")));
    }
}

[Serializable]
internal class SlaveResult
{
    public readonly string SlaveGeneratedMessage;

    public SlaveResult(string message)
    {
        SlaveGeneratedMessage = message;
    }
}

[Serializable]
internal class MasterWork : IWork
{
    private readonly SlaveResult _result;

    public MasterWork(SlaveResult result)
    {
        _result = result;
    }

    public void Execute(Socket endPoint)
    {
        Console.WriteLine("Do master work: " + endPoint.RemoteEndPoint);
        Console.WriteLine("Received from slave: " + _result.SlaveGeneratedMessage);
    }
}

internal class Program
{
    private static void Main(string[] args)
    {
        var master = new Master(12345);
        Task.Factory.StartNew(master.Start);

        Thread.Sleep(1000);

        const int slaveCount = 10;
        foreach (var index in Enumerable.Range(0, slaveCount))
        {
            var slave = new Slave("127.0.0.1", 12345);
            Task.Factory.StartNew(slave.Start);
        }

        while (master.ConnectedSlaveCount != slaveCount)
            Thread.Sleep(0);

        Logger.Write("Start!");
        while (true)
        {
            master.DistributeWork(new SlaveWork());
            Thread.Sleep(1000);
        }
    }
}
```

1. `Master`를 시작하고, `Slave`를 10개 만들어서 `Master`에 연결한다.
2. `Master`는 `SlaveWork` 객체를 만들어서 적절히 `Slave`에게 넘겨준다. 기본 알고리즘은 RoundRobin이므로 첫 번째 `Slave`부터 차례대로 일을 받게 된다.
3. `Slave`는 `SlaveWork`를 처리한 후, 수행한 결과를 `SlaveResult`에 담아서 `MasterWork` 객체를 `Master`에게 전달한다.
4. `Master`는 `MasterWork`를 받아서 그 내부에 있는 `SlaveResult`를 출력해준다.

모두 네트워크로 전송되기 위해 `SerializableAttribute`를 붙이고 있다.

### 정리 ###

본 글에서는 작업을 원격지에서 수행하고, 적절히 분산시킬 수 있는 분산 처리 환경을 C#으로 간단히 구현해봤다. Master와 Slave의 코드를 한 Assembly에 넣어놨기 때문에 Serialize/Deserialize를 수행함에 있어서 아주 편했다.

하지만 제대로 된 분산 환경에서 Master와 Slave가 같은 코드를 공유한다는 것은 다양한 작업/변경된 작업을 수행함에 있어서 매우 불리하다. 왜냐하면 Slave가 수행되는 머신의 바이너리가 지속적으로 교체되어야 하기 때문이다.

또한 위 코드는 단순한 RPC 작업을 수행함에 있어서 너무 많은 코드를 작성해야 한다. (적어도 두 개의 Work와 하나의 Result class를 작성해야 했다.)

따라서 다음 글에서는

* Master/Slave가 코드를 공유하지 않아도 수행될 수 있는 구조와
* RpcWork와 WorkGroup 설계를 추가하여 보다 간편한 분산 작업을

작성할 수 있도록 고민해보자.

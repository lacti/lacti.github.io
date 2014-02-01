---
layout: post
title: c# 데이터 서버 라이브러리 구현
tags: c# data -pub
---

지난 글에서는 csv 데이터를 binary 파일로 serialize하여 데이터의 loading 속도를 올리는 방법에 대해 알아보았다. 해당 방법은 용량이 큰 csv 파일에 대해서도 효과가 크지만, 작게 분할된 많은 csv 파일을 다시 적절한 크기의 binary 파일로 재구성하여 작업할 때 더욱 효과를 크게 느낄 수 있다.

하지만 csv 파일의 용량이 너무 크거나, 아니면 csv 파일이 너무 많을 경우에는 해당 방법을 사용하기가 어렵다. [.net vm은 x64 모드에서도 단일 객체에 대해 2GB 이상의 크기에 대한 메모리 할당 요청을 하면 `OutOfMemoryException`이 발생](http://stackoverflow.com/questions/1087982/single-objects-still-limited-to-2-gb-in-size-in-clr-4-0)하는데, 위 구조에서는 파일의 내용을 한 번에 `byte[]` 배열로 읽고, 그 결과물을 하나의 `List<T>`에 담는 구조이기 때문이다.

또한 이렇게 loading 시간을 단축한다고 해도 원본 데이터의 크기가 아주 클 경우에는 줄어든 loading 시간도 클 수 밖에 없다. 그리고 binary로 serialize/deserialize하는 기계적인 코드를 매번 수작업으로 입력해야 하는 것도 불필요한 부담이다.

따라서 본 글에서는 위에서 언급한 3가지 문제에 대해 어떻게 접근할지 알아보도록 하겠다.

#### collection of IEnumerable

데이터가 아주 크거나 많을 경우 .net vm 메모리 할당 한계로 인해 위 구조를 사용할 수 없는 문제가 있다. 이 문제를 해결하는 가장 간단한 방법은 binary 파일을 여러 개로 쪼갠 후 각각을 각기 다른 `List<T>`로 읽고, 이들에 대한 collection인 `List<List<T>>`에 대해 쿼리를 수행하는 방법일 것이다. 예를 들어, 위 예제에서 item*.bin 패턴으로 파일이 여러 개 있다고 할 경우,

```csharp
var itemsList = new List<List<ItemData>>();
foreach (var binPath in Directory.GetFiles(workspace, "item*.bin"))
{
    var items = new List<ItemData>();
    var bytes = File.ReadAllBytes(binPath);
    for (var offset = 0; offset < bytes.Length; offset += rowSize)
    {
        items.Add(new ItemData
        {
            Timestamp = BitConverter.ToInt32(bytes, offset + 0),
            DbId = BitConverter.ToInt64(bytes, offset + 4),
            UserDbId = BitConverter.ToInt64(bytes, offset + 12),
            TemplateId = BitConverter.ToInt32(bytes, offset + 20),
            Amount = BitConverter.ToInt32(bytes, offset + 24),
        });
    }
    itemsList.Add(items);
}
```

와 같이 `List<List<ItemData>>`를 만들고 여러 개의 `List<ItemData>`를 담는 것이다. 이렇게 될 경우 각 `List<ItemData>`에서 할당하는 메모리의 크기는 2GB를 넘지 않게 한다면 위 문제를 적어도 **읽는 과정에서는** 회피할 수 있을 것이다.

예를 들어 `itemLists`에 존재하는 수량(Amount)이 10개 이상인 서로 다른 `TemplateId`의 개수를 확인하려면 다음과 같이 쿼리를 작성하면 된다.

```csharp
itemsList.SelectMany(e => 
        e.Where(i => i.Amount >= 10).Select(i => i.TemplateId)
    ).Distinct().Count()
```

이 경우 `SelectMany()`는 가지고 있는 각 `List<ItemData>`를 차례로 순회하면서 `yield return`으로 각각을 반환한다. 따라서 반환 시 추가적인 메모리 할당을 요구하지 않으며 데이터를 stream 형태로 제공하게 된다. 그 이후 연결되는 `Select()`,`Where()`이나 `Distinct()`, `Count()` 역시 stream 형태로 작업을 수행하는 연산자이므로 메모리 문제를 유발하지 않는다.

하지만 `GroupBy()`나 `OrderBy()` 연산자 등 stream에 존재하는 모든 데이터를 buffer에 담고 작업을 처리해야하는 연산자의 경우에는 위 collection에 존재하는 모든 데이터를 담기 위한 내부 buffer를 할당해야 하므로 이 크기가 제한을 넘어가 프로그램이 정상 동작하지 않을 수 있다.

.NET Framework 4.5부터는 [gcAllowVeryLargeObjects](http://msdn.microsoft.com/en-us/library/hh285054.aspx) 옵션이 추가되었으므로 이 옵션을 통해 문제를 회피할 수 있다고도 한다.

#### data server

만약 데이터가 아주 커지고 더 많아질 경우 위와 같은 방법을 사용해도 여전히 loading 시간이 길어질 수 있다. 이 경우에는 지체없이 데이터베이스를 쓰면 된다 [...] 하지만 이왕 여기까지 왔으니 좀 더 나아가보자.

데이터를 매번 loading하는 것이 느리다면 한 번 띄워놓은 데이터를 계속 사용할 수 있으면 된다. 그러면 대충 다음의 방법을 생각해볼 수 있다.

- 데이터를 다 읽어둔 서버가 데이터 쿼리를 수행할 클라이언트에게 ipc로 데이터를 전달한다.
- 데이터 서버가 읽어둔 데이터를 shared memory로 클라이언트와 공유한다.
- 데이터 서버에게 연결한 클라이언트가 서버에게 데이터 쿼리를 보내고, 서버는 그 처리 결과를 클라이언트에게 돌려준다.

각 방법에 대해 살펴보도록 하자.

#### all-data retrieving by ipc

c# wcf는 잘 추상화되어 있으므로 IPC 통신 코드를 작성하는 것은 간단하다. 일단 교환을 위한 struct에 대해 `DataContract`를 명시해준다.

```csharp
[DataContract]
public struct ItemData
{
    [DataMember] public int Timestamp;
    [DataMember] public long DbId;
    [DataMember] public long UserDbId;
    [DataMember] public int TemplateId;
    [DataMember] public int Amount;
}
```

그리고 통신을 위한 interface를 선언한다. 위 struct와 아래 interface는 IPC 서버와 클라이언트가 모두 가지고 있어야 한다.

```csharp
[ServiceContract]
public interface IDataProvider
{
    [OperationContract]
    IEnumerable<ItemData> RetrieveItems();
}
```

이제 서버에서 위 interface를 구현하는 객체를 구현한다. 객체 생성 시 데이터를 읽어두고, `RetrieveItems()`를 부를 때 읽어놓은 데이터를 반환해주면 되겠다.

```csharp
public class DataProvider : IDataProvider
{
    private readonly List<ItemData> _items = new List<ItemData>();
    public DataProvider()
    {
        // load data
    }
    
    public IEnumerable<ItemData> RetrieveItems()
    {
        return _items;
    }
}
```

이제 필요한 모든 class 및 interface를 작성했으니 이를 IPC 서비스로 제공을 해주면 되겠다. 서버 쪽 구동 코드는 다음과 같다.

```csharp
using (var host = new ServiceHost(typeof(DataProvider),
    new Uri[] { new Uri("net.pipe://localhost") }))
{
    host.AddServiceEndpoint(typeof(IDataProvider),
        new NetNamedPipeBinding, "DataProvider");
    host.Open();
    
    Console.WriteLine("Server is running");
    Console.ReadLine();
    host.Close();
}
```

`ServiceHost`로 서비스할 객체를 지정하고, 서비스를 수행할 Endpoint를 지정한다. 그리고 `Open()`을 불러주면 된다. `Open()` 함수는 비동기 수행 함수이므로 서버 종료를 막기 위해 `ReadLine()`을 넣었다.

클라이언트는 이제 `net.pipe://localhost/DataProvider`에 접근해서 `RetrieveItems()` 함수를 호출하면 된다.

```csharp
var pipeFactory =
    new ChannelFactory<IDataProvider>(
    new NetNamedPipeBinding { MaxReceivedMessageSize = int.MaxValue },
    new EndpointAddress("net.pipe://localhost/DataProvider"));

var provider = pipeFactory.CreateChannel();
var items = provider.RetrieveItems();
```

다만 문제는 원래 이렇게 큰 객체를 주고 받기 위해 설계된 개념이 아니기 때문에 `MaxReceivedMessageSize` 값을 최대한 크게 설정해주어야 한다는 것이다. 그런데 이 값의 한계치가 `int.MaxValue`이므로 결국 데이터의 크기가 2GB보다 큰 것은 이 구현을 통해 받을 수가 없다는 것이다.

뿐만 아니라 위 코드를 동작시켜보면 local에서 자료를 직접 읽을 때보다 속도가 매우 느린 것을 확인할 수 있다. 심지어 이 글에서 계속 사용하고 있는 데이터 기준으로 첫 번째 예제보다 수행 속도가 느리다. 즉, 위와 같이 모든 `ItemData` 객체를 클라이언트에 받아서 쿼리를 수행하는 방식은 적절하지 않다는 것이다.

#### all-data retrieving by shared memory

위 IPC 통신이 느린 이유는 그렇게 쓰라고 만든 것이 아니기 때문인 이유도 있지만, IPC에서 객체를 주고 받을 때 발생하는 .NET serialize 비용이 꽤 크기 때문이다. .NET serializer는 전 글에서 구현한 `BinaryWriter` 수준의 Marshaling이 아닌 type 정보 등을 포함한 보다 복잡하고 큰 serializing을 수행한다. 때문에 느릴 수 밖에 없다.

그렇다면 IPC를 사용하지 않고 shared memory를 사용해서 문제를 해결할 수 있을까? 안타깝게도 별로 좋은 선택은 아니다. 왜냐하면 shared memory는 byte 수준의 메모리를 공유하는 기법이지 객체를 공유하기 위한 것이 아니기 때문이다.

즉 `List<ItemData>`를 서버 측에서 shared memory에 byte로 marshaling해서 올려놓든가 아니면 전 글에서 썼던 것처럼 `BinaryWriter`로 기록해놓고, 클라이언트는 이 byte를 다시 unmarshaling하거나 `BinaryReader`로 읽어야 한다. 그렇다면 기존과 비교하여 처음 binary 파일을 읽는 IO 비용만 없어지는 셈인데 이 방법은 구현 복잡도에 비해서 별로 큰 효과를 볼 수 있을 것 같지 않은 방법이다.

#### execute query in server

위 방법들이 별로 좋지 않은 이유는 클라이언트가 모든 객체에 대한 정보를 다 받은 뒤 클라이언트에서 쿼리를 수행하려 했기 때문이다. 이번에는 발상을 바꿔서 클라이언트에서 직접 쿼리를 하는 것이 아니라, **쿼리 객체를 서버로 전달하여 수행한 그 결과를 반환하도록** 설계해보자.

- 서버는 데이터를 모두 읽어서 메모리에 올려놓는다.
- 그리고 쿼리 수행을 위한 Service(IPC 등)를 시작한다.
- 클라이언트는 수행할 LINQ에 대해 `ExpressionTree`를 만든다.
- [ExpressionTree Serializer](http://expressiontree.codeplex.com/)를 사용하여 ExpressionTree를 서버로 전달한다.
- 서버는 전달 받은 `ExpressionTree` 객체에 대해 Query를 복원해서 읽어놓은 데이터에 대해 쿼리를 수행한다. 그리고 그 결과를 클라이언트에게 반환한다.
- 클라이언트는 결과를 받아서 적절히 보여준다.

간단한 데이터 처리 API인 셈이다.

`ExpressionTree` 자체는 Serializable하지 않으니 외부 라이브러리의 도움을 받는다. 그 외에는 위 IPC 예제와 동일하게 쿼리에 대한 `OperationContract` 하나 만들어주고 그 수행 결과를 반환 받도록 하면 된다. 이에 대해서는 이미 다음 라이브러리들이 적절한 예제를 구현해 놓았다.

- [ExpressionTree Serializer](http://expressiontree.codeplex.com/)
- [Serialize.Linq](https://github.com/esskar/Serialize.Linq)

#### binary serializer

이번에는 좀 다른 이야기를 해보자. 데이터를 serialize/deserialize하는 코드를 매번 손으로 직접 작성했다. 이는 굉장히 유사한 코드이지만 `ItemData`와 같은 struct가 추가될 때마다 그 struct에 대한 코드를 직접 작성해주어야 한다. 이를 개선해보자.

- Reflection에 의해 member type을 runtime에 확인하고 serialize를 수행하게 한다.
- struct에 대한 metadata를 정의하고 code generator를 사용하여 serialize 코드를 생성한다.

첫 번째 방법은 당연히 느리다. 데이터를 읽는 부분은 데이터의 개수만큼 수행되는 반복문 안에서 호출되는데 그 회수만큼 reflection을 사용하기 때문에 느릴 수 밖에 없다.

code generation은 나쁘지 않은 선택이다. 코드가 runtime 이전에 만들어지기 때문에 수행할 때에는 이미 작성된 코드로 동작하므로 손으로 작성한 것과 동일하게 빠른 동작을 보여줄 수 있다. 직접 generator를 만들어도 되고, vs랑 친한 T4를 사용하는 것도 가능하다. 하지만 코드 생성을 위해 build script를 수정해야 하는 귀찮은 문제가 있다. 만약 이 글에서 소개하는 동작을 위한 binary serailize를 라이브러리로 만들어 배포한다고 하면 해당 라이브러리 사용자가 build script 수정도 해야 하므로 별로 좋아보이지는 않는다.

둘의 장점을 모두 취해보자. code generator를 사용하지 않고 runtime에 reflection으로 struct의 구조를 파악하여 직접 CLR code를 생성하는 것이다. 즉, `Reflection.Emit`을 사용하여 `Dynamic Invoke`를 사용하는 것이다.

#### Reflection.Emit

IL 코드를 직접 다 공부해서 작성하는 방법도 좋지만 일단 c# 프로그램 작성 후 **ILDASM** 프로그램을 사용하여 얻어낸 IL을 기록하는 방법으로 작업하는 것이 편하다.

간단하게 `BitConverter`를 사용하여 binary로부터 특정 객체를 읽는 코드를 IL로 작성해보면 다음과 같다.

```csharp
var method = new DynamicMethod(methodName, typeof(IData),
    new[] { typeof(byte[]), typeof(int).MakeByRefType() });
var generator = method.GetILGenerator();
var localData = generator.DeclareLocal(valueType);
generator.Emit(OpCodes.Ldloca_S, localData);
generator.Emit(OpCodes.Initobj, valueType);
foreach (var field in valueType.GetFields())
{
    if (field.FieldType != typeof (string))
    {
        // read and set value
        generator.Emit(OpCodes.Ldloca_S, localData);
        generator.Emit(OpCodes.Ldarg_0);
        generator.Emit(OpCodes.Ldarg_1);
        generator.Emit(OpCodes.Ldind_I4);
        generator.Emit(OpCodes.Call, BitConverterMap[field.FieldType]);
        generator.Emit(OpCodes.Stfld, field);

        // increase offset
        generator.Emit(OpCodes.Ldarg_1);
        generator.Emit(OpCodes.Dup);
        generator.Emit(OpCodes.Ldind_I4);
        generator.Emit(OpCodes.Ldc_I4, TypeSizeMap[field.FieldType]);
        generator.Emit(OpCodes.Add);
        generator.Emit(OpCodes.Stind_I4);
    }
    else // 생략
}
generator.Emit(OpCodes.Ldloc_0);
generator.Emit(OpCodes.Box, valueType);
generator.Emit(OpCodes.Ret);
```

지정된 type의 field를 순회하면서 그에 맞는 `BitConverter`의 함수를 호출한 후 값을 field에 넣어주는 코드이다. 만약 잘못 작성할 경우 `InvalidProgramException`이 발생하게 된다. 여러 type을 다루어야 할 수 있으므로 반환 시 boxing을 해줬다.

위와 같이 코드를 작성하고 `CreateDelegate()`로 delegate를 생성하면 다음과 같이 쓸 수 있다.

```csharp
delegate IData BinReader(byte[] bytes, ref int offset);
var reader = (BinReader)method.CreateDelegate(typeof(BinReader));
var offset = 0;
while (offset < bytes.Length)
{
    items.Add((ItemData) reader(bytes, ref offset));
}
```

Reflection.Emit 관련된 내용을 여기서 서술하면 너무 길어질 수 있으므로 일단 넘어가도록 하겠다.

- [Codeproject: Introduction to Creating Dynamic Types with Reflection.Emit](http://www.codeproject.com/Articles/13337/Introduction-to-Creating-Dynamic-Types-with-Reflec)
- [Codeproject: Introduction to Creating Dynamic Types with Reflection.Emit: Part 2](http://www.codeproject.com/Articles/13969/Introduction-to-Creating-Dynamic-Types-with-Refl)
- [Codeproject: Fast Dynamic Property Access with C#](http://www.codeproject.com/Articles/9927/Fast-Dynamic-Property-Access-with-C)

#### 마무리

단순히 데이터를 binary로 serialize하는 것을 넘어 data server를 구현하거나, 보다 일반적인 라이브러리를 위한 Reflection.Emit까지 다뤄보았다.

데이터를 처리함에 있어서 당연히 데이터베이스를 사용하면 좋갰지만, 

- 굳이 그럴 필요가 없는 정적인 데이터 (데이터시트 등)
- 가공된 데이터에 대한 cache
- 데이터베이스의 규격으로 담기 힘든 데이터

등에 대해서는 위와 같은 방법으로 간단히 데이터 서버를 구축해서 사용하는 것도 괜찮지 않을까 생각한다. 일종의 [Data Virtualization](http://en.wikipedia.org/wiki/Data_virtualization) 인 셈이다.
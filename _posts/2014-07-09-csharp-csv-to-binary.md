---
layout: post
title: c# binary 파일을 사용해 csv 파일 빨리 읽기
tags: c# data -pub
---

데이터 분석을 위해 데이터를 열심히 수집해서 몇 개의 csv 파일을 얻었고, 이 csv 파일들은 각각 약 1GB 정도로 조금 큰 수준이라고 해보자. 데이터베이스가 있으면 데이터를 넣고 적절한 쿼리를 넣으면 되니 편하게 작업을 진행할 수가 있다. 하지만 데이터베이스가 없는 시스템에서 이 데이터들을 분석하거나, 쿼리로는 데이터 분석을 하기가 좀 어려운 상황이라고 할 경우에는 적어도 다음의 방법을 사용하여 분석을 진행해 볼 것이다.

1. csv를 parsing하여 메모리에 올린다.
2. 메모리에 올린 모델을 적절히 aggregation하여 원하는 결과를 찾아본다.

각 부분에 대한 프로그램을 작성하는 것은 별로 큰 부담이 아니다. c#을 사용할 경우, 충분히 추상화된 io 함수와 문자열 라이브러리와 linq가 있기 때문이다.

문제는 **csv parsing** 시간이 꽤 오래 걸린다는 것이다. 연산을 잘못하여 aggregation 로직을 수정할 경우 매번 csv parsing이 다시 일어나기 때문에 데이터 분석을 위한 시간은 계속 길어질 수 밖에 없다. 본 글에서는 이 과정을 빠르게 하기 위한 csv 데이터의 binary serialize 과정을 알아보도록 하겠다.

```csharp
struct ItemData
{
    public int Timestamp;
    public long DbId;
    public long UserDbId;
    public int TemplateId;
    public int Amount;
}
```

이라는 자료구조가 있다고 해보자. 이에 대한 테스트 데이터를 csv로 대충 만들기 위해 다음과 같은 generator를 만들었다. 별 의미 없이 random 값을 `ItemData`에 담아서 10M개의 데이터를 csv로 만들어주는 것이다. 약 362MB 정도이다. (timestamp로 정렬한 것은 그럴싸하게 만들기 위함이지 별다른 뜻은 없다.)

```csharp
var items = new List<ItemData>();
var random = new Random();
for (int i= 0; i < 10 * 1024 * 1024; ++i)
{
    items.Add(new ItemData
    {
        Timestamp = random.Next(1404715000, 1404716000),
        DbId = random.Next(10000, 30000),
        UserDbId = random.Next(),
        TemplateId = random.Next(1000, 4000),
        Amount = random.Next(1, 50)
    });
}
items.Sort((left, right) => left.Timestamp - right.Timestamp);
var path = Path.Combine(workspace, "item.csv");
using (var writer = new StreamWriter(path, false))
{
    foreach (var e in items)
    {
        writer.WriteLine(string.Join(",",
            e.Timestamp, e.DbId, e.UserDbId, e.TemplateId, e.Amount));
    }
}
```

#### csv reader 1

362MB의 csv 파일을 parsing하여 `ItemData`에 넣는 코드를 작성해보자. 간단하게

1. csv 파일을 열고,
2. 줄 단위로 읽으면서
3. comma 문자로 분리하고
4. int나 long으로 Parse하는

코드를 생각해볼 수 있겠다.

```csharp
var items = new List<ItemData>();
using (var reader = new StreamReader(csvPath))
{
    while (reader.BaseStream.Position < reader.BaseStream.Length)
    {
        var parts = reader.ReadLine().Split(',');
        items.Add(new ItemData
        {
            Timestamp = int.Parse(parts[0]),
            DbId = long.Parse(parts[1]),
            UserDbId = long.Parse(parts[2]),
            TemplateId = int.Parse(parts[3]),
            Amount = int.Parse(parts[4]),
        });
    }
}
```

파일을 접근하기 위해 `StreamReader`를 열고, 한 줄씩 읽어서 `Split`한 후 `int.Parse`를 사용했다. 시간을 재보면 딱히 어떤 부분이 많이 걸리는 것 같지는 않다. 그냥 전체적으로 많이 호출되어서 느린 것 같아 보인다. 좀 더 자세히 보자.

- `StreamReader`는 지정한 파일을 연 후 내부의 buffer를 갖고 파일을 읽을 수 있게 해주는 객체다.
- `ReadLine()`은 `StreamReader` 내부 buffer에서 newline 문자를 찾고, 그 이전까지의 string을 반환한다. 만약 buffer에 newline이 없다면, 파일에 다시 접근하여 파일을 좀 더 읽는다.
- `int.Parse()`나 `long.Parse()`는 입력받은 문자열이 올바른 숫자 형태인지 검사한 후, 그것을 적절히 int나 long type으로 변환(convert)해서 반환하는 함수이다.

많이 불린 것은 맞지만 결국 모든 부분이 느리기 때문에 전체적으로 느려지는 것이다.

#### csv reader 2

일단 `StreamReader`에 의해 파일을 여러 번 접근하는 부분을 개선해보자. 즉, `File.ReadAllLines()` 함수를 써서 파일을 한 번에 모두 읽은 후 각 line 별로 접근하도록 해보자.

```csharp
var items = new List<ItemData>();
foreach (var line in File.ReadAllLines(csvPath))
{
    var parts = line.Split(',');
    items.Add(new ItemData
    {
        Timestamp = int.Parse(parts[0]),
        DbId = long.Parse(parts[1]),
        UserDbId = long.Parse(parts[2]),
        TemplateId = int.Parse(parts[3]),
        Amount = int.Parse(parts[4]),
    });
}
```

코드가 좀 더 간단해졌다. `File.ReadAllLines()` 함수는 파일을 한 번에 다 읽어놓은 뒤 `IEnumerable<string>` 형태로 각 line을 반환해주는 c# 내장 함수이다. 따라서 위와 같이 수행해보면 `File.ReadAllLInes()`에서 걸리는 시간이 좀 길게 측정되지만 전체적으로는 첫 번째 예제보다 빨라진다.

재미있는 점은 위 프로그램을 두 번째 실행할 때에는 `File.ReadAllLines()` 수행이 꽤 빨라진다는 것이다. 그 이유는 첫 번째 수행 시 csv 파일이 io cache에 들어가서 두 번째 실행 시에는 상대적으로 io 부담이 줄어들기 때문이다. 이 성능 차이는 ssd보다 io 비용이 비싼 hdd에서 테스트할 때 보다 확실히 느낄 수 있다.

#### binary serialize

io 비용을 줄이기 위해 조금씩 io를 여러 번 부르는 것보다는 한 번에 다 읽어놓고 작업하는게 더 빠르다는 것을 알았다. (물론 메모리가 허용할 때의 이야기이다. 메모리가 허용하지 않는다면 `StreamReader`를 써야한다.)

이제 newline을 찾는 비용과 `int.Parse()` 비용을 줄이기 위한 방법을 생각해보자. 간단하다. `ItemData`는 고정 크기의 데이터이므로 데이터 그 자체를 binary로 쓰는 것이다. (c++에서는 보다 손쉽게 memory를 file로 dump할 수 있지만 c#은 vm 기반이므로 그렇지 않다.)

```csharp
var binPath = Path.Combine(workspace, "item.bin");
using (var fileStream = new FileStream(binPath, FileMode.Create, FileAccess.Write, FileShare.None))
using (var writer = new BinaryWriter(fileStream))
{
    foreach (var item in items)
    {
        writer.Write(item.Timestamp);
        writer.Write(item.DbId);
        writer.Write(item.UserDbId);
        writer.Write(item.TemplateId);
        writer.Write(item.Amount);
    }
}
```

`FileStream`으로 내보낼 파일에 대한 stream을 만들고 `BinaryWriter`를 사용해서 각 field 별로 `Write()`를 해주면 된다. 이제 item.bin 파일에는 순서대로, timestamp / dbid / userdbid / templateid / amount가 기록된다. 한 row의 크기가 28(4+8+8+4+4)인 고정 크기의 record가 연속적으로 기록된 binary 파일이라고 생각하면 된다.

이렇게 작성된 bin 파일의 크기는 280MB이다. 비록 고정 길이 record이지만 newline과 comma 문자가 빠져서 득을 많이 보았다. 이제 읽어보자.

#### binary reader 1

간단히 구현해보면, csv 파일을 읽을 때와 동일한 구조가 나온다.

```csharp
var items = new List<ItemData>();
using (var fileStream = File.OpenRead(binPath))
using (var reader = new BinaryReader(fileStream))
{
    while (fileStream.Position < fileStream.Length)
    {
        items.Add(new ItemData
        {
            Timestamp = reader.ReadInt32(),
            DbId = reader.ReadInt64(),
            UserDbId = reader.ReadInt64(),
            TemplateId = reader.ReadInt32(),
            Amount = reader.ReadInt32(),
        });
    }
}
```

단지 `ReadLine()`과 `Parse()` 대신 `BinaryReader` 객체를 사용하여 해당 파일을 다 읽을 때까지 각 field의 크기에 맞게 byte를 읽어주는 것이 다르다.

두 번째 예제에 비해 속도 향상이 있기는 하지만 큰 차이는 아니다. 그 이유는 `FileStream`이 내부 buffer를 사용하는 구조이므로 첫 번째 예제와 동일하게 io를 여러 번 발생시키기 때문이다. 이 구조를 좀 더 개선해보자.

#### binary reader 2

방법은 간단하다. 미리 binary bytes를 다 읽어두고 `FileStream` 대신 `MemoryStream`을 사용하는 것이다.

```csharp
var items = new List<ItemData>();
var bytes = File.ReadAllBytes(binPath);
using (var memoryStream = new MemoryStream(bytes))
using (var reader = new BinaryReader(memoryStream))
{
    while (memoryStream.Position < memoryStream.Length)
    {
        items.Add(new ItemData
        {
            Timestamp = reader.ReadInt32(),
            DbId = reader.ReadInt64(),
            UserDbId = reader.ReadInt64(),
            TemplateId = reader.ReadInt32(),
            Amount = reader.ReadInt32(),
        });
    }
}
```

`File.ReadAllBytes()`는 c# 내장 라이브러리로 지정된 파일의 모든 bytes를 한 번에 읽어 메모리로 올린다. `BinaryReader`는 Stream 객체를 필요로 하므로 이 bytes를 Stream으로 만들어주기 위한 `MemoryStream`을 사용하는 것이다. io 비용을 처음 한 번에 다 지불하기 때문에 세 번째 예제에 비해 속도가 크게 향상된다.

`BinaryReader` 때문이지만 필요하지도 않은 `MemoryStream` 객체를 만들어서 굳이 비용을 더 지불할 필요는 없다. 왜냐하면 `BitConverter`가 있기 때문이다. 좀 더 개선해보자.

#### binary reader 3

`BitConverter`는 지정된 byte 배열의 위치(offset)로부터 지정된 형(type)으로 값을 읽어주는 c# 내장 라이브러리이다. 이를 사용하면 코드를 다음과 같이 작성할 수 있다.

```csharp
var items = new List<ItemData>();
var bytes = File.ReadAllBytes(binPath);
var rowSize = sizeof(int) + sizeof(long) + sizeof(long) + sizeof(int) + sizeof(int);
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
```

`ItemData`는 고정 길이 record이기 때문에 미리 row-size를 계산해둘 수 있다. 따라서 메모리에 다 읽어둔 byte 배열을 row-size만큼 증가시키면서 각 위치의 field를 적절히 변환해서 `ItemData` 객체에 넣어주면 되는 것이다. 이렇게 작성하면 네 번째 예제보다 (미약하지만) 성능 개선 효과를 얻을 수 있다.

#### 왜 c#인가

사실 c++로 작성한다면 위 과정이 훨씬 간단해진다. 단순히 `ItemData` 배열을 할당한 다음 `fwrite()` 함수의 인자로 `ItemData` 배열의 주소를 넘겨서 dump를 하고, 읽을 때에는 file-size만큼 다 읽은 뒤 `ItemData*`로 casting해서 접근하면 되기 때문이다.

그럼에도 불구하고 c#을 고집한 이유는 다음과 같다.

```csharp
items.GroupBy(e => e.TemplateId).Select(e =>
    new { TemplateId = e, SumOfAmount = e.Sum(i => i.Amount) }).Dump();
```

위 코드는 TemplateId 별 Amount의 총량을 구해서 보여주는 LINQ 코드이다. (`Dump()` 함수는 [LINQPad](http://www.linqpad.net/)에서 지원하는 함수로 쿼리 수행 결과를 테이블로 이쁘게 보여주는 함수이다.)

물론 c++에 비해 다소 속도가 느리고 메모리가 많이 필요할 수는 있지만 데이터의 쿼리를 날리기에는 LINQ를 쓸 수 있는 c#이 c++에 비해 훨씬 작업하기가 좋다.

#### 속도 비교

위 예제의 속도를 비교해보자. 속도는 내 컴퓨터(i5-4200U, 8GB) LinqPad AnyCPU를 기준으로 대충 측정하였다.

| name   	| time (sec) 	|
|--------	|------------	|
| csv #1 	| 28         	|
| csv #2 	| 17         	|
| bin #1 	| 14         	|
| bin #2 	| 2          	|
| bin #3 	| 1          	|

고작 362MB의 데이터지만 충분한 속도 상승 효과가 나오고 있는 것을 볼 수 있다.

#### 마무리

대용량의 csv 파일을 읽어서 작업해야 할 일이 있을 경우 그 구조가 간단하다고 해도 io 비용과 parsing 비용 때문에 loading 시간이 만만치 않다. 이 경우 위처럼 csv을 미리 parsing 해둔 binary 파일을 만들어서 보다 빠르게 작업을 진행할 수 있다.

하지만 여전히 문제가 있다.

- 훨씬 더 큰 양의 데이터를 다뤄야할 때에는 vm에서 허용해주는 메모리의 한계를 넘을 수도 있는데 위 구조를 적용할 수 있을까?
- loading 시간을 단축했지만 그조차도 클 경우에 사용할만한 좀 더 좋은 방법이 없을까?
- 매번 다른 자료구조에 대해서 매번 binary로 serialize해주고 deserialize해주는 코드를 작성해야 할까?

이에 대해서는 추후 글에서 알아보도록 하자.
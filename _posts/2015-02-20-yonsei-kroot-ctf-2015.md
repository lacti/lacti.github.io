---
layout: post
title: kroot ctf 2015
tags: c# kroot ctf
---

연세대학교 보안 동아리 [Kroot](http://kroot.yonsei.ac.kr/)에서 주최하는 [CTF 2015](http://krootctf.yonsei.ac.kr/)에 참가했다. 보안이란 주제랑은 별로 관련이 없는 삶을 살아온지라 [...] 난이도 낮은 문제 + 힌트가 공개된 문제를 중점으로 풀었다.

웹은 아는게 없는지라 바로 스킵했다-_-;

[challensges](http://krootctf.yonsei.ac.kr/challenges)에서 문제 내역을 확인할 수 있다...근데 지금 다 undefined로 나오고 있는데 이게 잠시 발생한 장애인지, 아니면 앞으로 계속 이럴지는 잘 모르겠다.

### 문제풀이 내역

이 문서에서는 각 문제를 어떻게 풀었는지 간단히 요약한다. 문제는 c#으로 풀었다. linqpad에서 풀었고 필요 시 nuget으로 library를 추가해서 썼다.

#### misc #2 

kroot____ 문자열에 대한 SHA1 값이 주어질 때 ____에 들어갈 문자열을 찾는다. 다행히 문자열에 대한 dictionary를 제공해줬다.

```csharp
var target = "1fdc6d2dd3f6041374e63f124684898e747f4d0f".StringToByteArray();
using (var sha1 = SHA1.Create())
{
	foreach (var line in File.ReadAllLines("dictionary_1e93cafb.txt"))
	{
		var message = "kroot" + line;
		var bytes = sha1.ComputeHash(Encoding.UTF8.GetBytes(message));
		if (target.SequenceEqual(bytes))
		{
			Console.WriteLine(line);
			break;
		}
	}
}
```

#### misc #3

압축 파일의 암호를 찾아 압축을 풀고 flag를 찾는다. 암호는 kroot_____으로 00000 ~ 99999까지가 들어갈 수 있다.

간단히 [sharpziplib](https://github.com/icsharpcode/SharpZipLib)을 사용해서 예제의 [ExtractZipFile](https://github.com/icsharpcode/SharpZipLib/wiki/Zip-Samples#user-content--unpack-a-zip-with-full-control-over-the-operation) 함수에 가능한 암호를 모두 사용해서 풀도록 했다.

```csharp
const string zipPath = "password_e635597a.zip";
const string outputPath = "kroot_ctf_2015";
foreach (var password in Enumerable.Range(0, 100000).Select(e => string.Format("kroot{0:D05}", e)))
{
	try
	{
		ExtractZipFile(zipPath, password, outputPath);
		Console.WriteLine(password);
		break;
	}
	catch {}
}
```

#### algorithm #4

점 3개를 입력 받아서 평면방정식을 구한다. `ax+by+cz+d=0`의 a, b, c, d를 구하되 a는 양수이고 이들은 서로이어야 한다.

점 2개의 vector 구해서 행렬식으로 풀었다.

```csharp
var val = line.Replace("(", "").Replace(")", "").Replace(",", "").Split(' ')
		.Where(i => !string.IsNullOrWhiteSpace(i)).Select(int.Parse).ToArray();
var p1 = new Point(val[0], val[1], val[2]);
var p2 = new Point(val[3], val[4], val[5]);
var p3 = new Point(val[6], val[7], val[8]);

var a = p1.X - p2.X; var b = p1.Y - p2.Y; var c = p1.Z - p2.Z;
var d = p1.X - p3.X; var e = p1.Y - p3.Y; var f = p1.Z - p3.Z;

var alpha = b * f - c * e;
var beta = c * d - a * f;
var gamma = a * e - b * d;
var delta = -1 * (alpha * p1.X + beta * p1.Y + gamma * p1.Z);
```

그리고 alpha 양수로 맞추고 최대공약수 찾아서 나눠주고 했다. tcp로 응답하는 문제이므로 간단히 socket 코딩을 했다.

```csharp
TcpClient client = new TcpClient("krootctf.yonsei.ac.kr", 8002);
using (var reader = new StreamReader(client.GetStream()))
using (var writer = new StreamWriter(client.GetStream()))
{
	while (true)
	{
		var count = reader.ReadLine();
		if (count == null)
			break;
		Console.WriteLine(count);
		
		var line = reader.ReadLine();
		if (line == null)
			break;
		Console.WriteLine(line);
		
		var plain = GetPlain(line);
		var answer = string.Format("{0} {1} {2} {3}", plain.A, plain.B, plain.C, plain.D);
		writer.Write(answer + "\n");
		writer.Flush();
		Console.WriteLine(answer);
		
		var result = reader.ReadLine();
		Console.WriteLine(result);
	}
}
```

socket 틀은 고정이므로 이후 문제에 대해서는 위 틀을 언급하지 않는다. 다만 초반에 별 지식이 없어서,

- `Flush()`를 호출하지 않고 왜 응답이 제대로 안 오나를 한참 고민하고 [...]
- line delimiter로 `\n`이 아니라 `\r\n`을 썼다가 잘못 인식되어서 또 한참 고민했다 [...] 

#### vulnerable #5

용이랑 싸우는 문제다. 제약상 통상적인 공격으로 용을 이길 수는 없고, 매 턴마다 힐을 쓰는 용의 패턴을 이용해 용의 hp를 overflow시킨다. 힐 쓰다가 mp 부족하면 mp 채우면서 버티면 된다.

```csharp
// network stream
string line = null;
var index = 0;
while ((line = reader.ReadLine()) != null)
{
	Console.WriteLine(line);
	if (line.Contains("Your skills"))
	{
		var command = ++index % 4 == 0 ? 3 : 2;
		writer.Write("{0}\n", command);
		writer.Flush();
	}
}
``` 

#### crypto #8

snail 문제다. 주어진 문서 100 x 100 배열 만들어넣고 snail 풀어서 결과를 sha1해주면 된다. 대충 간단히 짰다.

```csharp
char[,] snail = new char[100, 100];
// put string into 100x100 array of character
var result = new StringBuilder();
bool[,] visit = new bool[100, 100];

var dirIndex = 0;
var dirs = new[]
{
	new Vec(0, 1), new Vec(1, 0), new Vec(0, -1), new Vec(-1, 0)
};
var pos = new Vec(0, 0);
while (pos != null && !visit[pos.Y, pos.X])
{
	visit[pos.Y, pos.X] = true;
	result.Append(snail[pos.Y, pos.X]);
	
	Vec nextPos = null;
	for (int i = 0; i < dirs.Length; i++)
	{
		nextPos = new Vec(pos.X + dirs[dirIndex].X, pos.Y + dirs[dirIndex].Y);
		if (nextPos.X < 0 || nextPos.X >= 100 || nextPos.Y < 0 || nextPos.Y >= 100
			|| visit[nextPos.Y, nextPos.X])
		{
			dirIndex = (dirIndex + 1) % dirs.Length;
		}
		else break;
	}
	pos = nextPos;
}
```

#### pwnable #9

root 권한이 있어야 읽을 수 있는 flag 파일, s 권한이 있는 실행 파일이 있다. s 권한이 있는 실행 파일은 `system("ls -l")` 명령을 수행하는데 정확히 `ls`가 뭔지 명시를 안해줬으므로 내가 만든 `ls`를 실행해주면 되겠다.

간단히 내 dir에서 `ls`를 만든 후 PATH에 ls 경로를 추가하고 위 실행 파일을 실행한다.

#### forensic #11

문제의 png 파일을 hex editor로 열어서 하단부에 잘 보면 PK으로 시작하는 부분이 있다. 이 부분만 추출하면 zip 파일을 얻을 수 있고 얻어낸 zip 파일을 풀면 여러 text가 나온다. 이걸 다 합쳐서 읽어주면 된다.

```csharp
string.Join("", Directory.GetFiles("texts", "*.txt").Select(File.ReadAllText))
```

#### network #12

pcap 파일을 wireshark로 열어서 target host를 찍고 frame을 좀 보면 http packet임을 확인할 수 있다. wireshark는 그러한 frame을 reassemble해주므로 protocol이 http인 대상을 찾아서(`http 200 ok`) data 부분만 export하면 된다.

그러면 binary 파일이 나오는데 md5 checksum을 제출하면 된다.

#### misc #15

조각난 이미지 파일을 이어붙여서 읽는 문제다. 일단 퍼즐을 어떻게 풀라는지 문제가 이해가 안되어서 문제에 서술한 수식 그대로 png 파일을 조합했다.

```csharp
const string imagePathFormat = @"puzzle_080bdb7c\img_{0}{1}.png";
Bitmap bitmap = new Bitmap(400, 400);
using (var g = Graphics.FromImage(bitmap))
{
	var yDomain = Enumerable.Range(1, 10).Select(e => e % 10).ToArray();
	var xDomain = Enumerable.Range(0, 10).ToArray();
	foreach (var y in Enumerable.Range(0, 10))
	foreach (var x in Enumerable.Range(0, 10))
	{
		var path = string.Format(imagePathFormat, yDomain[y], xDomain[x]);
		var image = Image.FromFile(path);
		g.DrawImage(image, new PointF(40 * x, 40 * y));
		path.Dump();
	}
}
bitmap.Save("result.png");
```

결과로 애매하게 찌그러진 qr code가 나와서 대충 photoshop으로 배열을 맞춰주고 reader로 읽으면 flag가 나온다.

#### algorithm #17

[Walsh Matrix](http://en.wikipedia.org/wiki/Walsh_matrix)을 구하고 지정된 row의 1인 column index의 합을 구한다. n이 굉장히 커지면 matrix를 다 구하지 않고 문제를 풀어야겠지만 *그럴 일이 없다고 가정하고 + 내 컴퓨터의 성능을 믿고* 그냥 matrix 다 구해서 풀었다.

```csharp
Dictionary<int, BitArray> cacheMap = new Dictionary<int, BitArray>();
int SumOfNonNegativeColumnIndex(int n, int row)
{
	if (n == 1)
		return 1;
		
	var sum = 0;
	var bits = GetOrCreateBitArray(n);
	foreach (var col in Enumerable.Range(1, n))
	{
		if (bits[(row - 1) * n + col - 1])
			sum += col;
	}
	return sum;
}

BitArray GetOrCreateBitArray(int n)
{
	BitArray bits;
	if (cacheMap.TryGetValue(n, out bits))
		return bits;
		
	if (n == 2)
	{
		bits = new BitArray(4);
		bits.Set(0, true);
		bits.Set(1, true);
		bits.Set(2, true);
		bits.Set(3, false);
	}
	else
	{
		bits = new BitArray(n * n);
		var halfs = GetOrCreateBitArray(n / 2);
		CopyTo(n, bits, halfs, 0, 0, false);
		CopyTo(n, bits, halfs, 0, n / 2, false);
		CopyTo(n, bits, halfs, n / 2, 0, false);
		CopyTo(n, bits, halfs, n / 2, n / 2, true);
	}
	cacheMap.Add(n, bits);
	return bits;
}

void CopyTo(int n, BitArray dest, BitArray src, int y, int x, bool negate)
{
	for (var i = 0; i < n / 2; i++)
	for (var j = 0; j < n / 2; j++)
	{
		var value = src[i * n / 2 + j];
		dest[(y + i) * n + (x + j)] = !negate ? value : !value;
	}
}
```

그래도 두려워서 BitArray를 썼는데 다행히 n이 1024 정도만 나와서 별 문제가 없었다.

network 문제여서 socket template을 가져다 썼다. 다만 정규식의 존재를 까먹고 문제 부분을 어떻게 parsing할까 꽤 고민을 했다-_-;

#### crypto #24

key1, 2에 대해 byte serial의 홀수열과 짝수열이 xor로 암호화된 파일을 복호화하는 문제다. key1, 2는 `[a..z]`이므로 이 구간에 대해 나올 수 있는 `26x26` 가지 수를 확인하고 복호화를 하면 되겠다.

일단 다음과 같이 첫 256bytes 정도만 간을 보고,

```csharp
foreach (var key1 in Enumerable.Range(0, 26).Select(e => (byte)(e + (int)'a')))
foreach (var key2 in Enumerable.Range(0, 26).Select(e => (byte)(e + (int)'a')))
{
	byte[] dec = File.ReadAllBytes("mycrypto_enc_19094444").Take(256).ToArray();
	for (int i = 0; i < dec.Length; i++)
	{
		if (i % 2 == 0) dec[i] ^= key1;
		else dec[i] ^= key2;
	}
	File.AppendAllText("result.txt", string.Format("{0},{1}\n", key1, key2));
	File.AppendAllText("result.txt", Encoding.UTF8.GetString(dec) + "\n\n");
}
```

눈으로 훑어보니 `(key1,key2) = (107,114)` 이므로 해당 값으로 파일 전체를 복호화한 후 pdf 파일에서 flag를 읽었다.

#### misc #25

`[file header...][file data 1K (RR)...]` 방식의 파일이므로 역순으로 읽으면 되겠다. entry 개수를 기록하지는 않고 delimiter(`0xFF`) 구문해놓은 것 같은데 개수 세는 것까지 하면 귀찮을 것 같아 개수는 눈으로(...) 세고 archiving을 풀었다.

```csharp
const string EOF = "yum3EOF";
var bytes = File.ReadAllBytes("output_9aadad33.yum3tar");
var cursor1 = 0;
var cursor2 = 0;
var entries = new List<Entry>();
for (int i = 0; i < 7; i++)
{
	cursor1 = NextFF(bytes, cursor2);
	cursor2 = NextFF(bytes, cursor1);
	entries.Add(new Entry {
		Name = Encoding.UTF8.GetString(bytes, cursor1, cursor2 - cursor1 - 1),
		Length = BitConverter.ToInt32(bytes, cursor2)
	});
}
foreach (var entry in entries)
	File.Delete(Path.Combine(outPath, entry.Name));

var entryIndex = 0;
var cursor = NextFF(bytes, cursor2);
while (cursor + EOF.Length < bytes.Length)
{
	while (entries[entryIndex].Length == 0)
		entryIndex = (entryIndex + 1) % entries.Count;
		
	var fetchSize = Math.Min(1024, entries[entryIndex].Length);
	entries[entryIndex].Bytes.AddRange(bytes.Skip(cursor).Take(fetchSize));
	entries[entryIndex].Length -= fetchSize;
	
	cursor += fetchSize;
	entryIndex = (entryIndex + 1) % entries.Count;
}

foreach (var entry in entries)
{
	File.WriteAllBytes(Path.Combine("unpack", entry.Name), entry.Bytes.ToArray());
}
```

#### algorithm #28

1을 `()>{}`이라 했을 때 neg, shl과 complement를 사용해서 다른 숫자들을 표현하면 되는 것이다. 따라서 2로 나누었을 때 홀수가 되면 complement+neg 처리 후 다시 shl로 처리해주면 된다.


```csharp
string NewNumber(int value)
{
	if (value == 1) return "()>{}";
	if (value > 0 && value % 2 == 0) return "(" + NewNumber(value / 2) + ")<<(()>{})";
	if (value < 0 && value % 2 == 0) return "~(" + NewNumber(-1 * value / 2) + ")<<(()>{})";
	return "~(" + NewNumber(-1 * value + 1) + ")";
}
```

문제의 요구 사항대로 0x20 ~ 0x7F까지 출력해주면 된다.

### 마무리

적절히 쉬운 문제도 많고 힌트도 많아서 없는 실력에도 재밌게 했다. 다만 좀 아쉬운건 학과 내부 사람을 대상으로만 진행했고 그나마도 홍보가 좀 덜 되어서 모처럼 좋은 기회를 놓친 사람이 많은 것 같다는 것이다. 다음에 이런 행사가 있으면 좀 더 주변에 널리 소문내야겠다 :)

준비한 분들이 정말 대단하고 멋지다. 나도 언젠가는 이런거 열어보고 싶다 [...] 능력이 된다면 [...]
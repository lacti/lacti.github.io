---
layout: post
title: ClassLoader를 사용하여 Resource Stream 얻기
tags: java
---

```java
import java.util.Scanner;

public class Loader {
	public void printResourceList() {
		Scanner reader = new Scanner(getClass().getResourceAsStream("ResourceList"));
		while (reader.hasNextLine()) {
			System.out.println(reader.nextLine());
		}
		reader.close();
	}
	public static void main(String[] args) {
		new Loader().printResourceList();
	}
}
```

class 파일이 있는 위치와 resource가 같다면 위처럼 간단히 `getClass().getResourceAsStream()`으로 읽어올 수 있고, 그렇지 않다면 URL을 적절히 활용해서 읽어올 수 있다.
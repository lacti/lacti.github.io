---
layout: post
title: Classical Inheritance in JavaScript
tags: javascript
---

[Classical Inheritance in JavaScript](http://javascript.crockford.com/inheritance.html)

JavaScript: The World's Most Misunderstood Programming Language을 쓴 Douglas Crockford란 분이 쓴 글인데 지난 번에 귀찮아서 안 읽었다가 요번에 읽어보니까 꽤 좋은 내용이다.  
javascript에서 객체지향적 구성이 필요할까에 대해 의문이 있지만 재사용성을 고려해볼 때 생각해볼만한 주제이므로 알아두는 것도 좋겠다.

하지만 기본적으로 여타 객체지향적 언어와 같은 문법으로 지원하지는 않으니 보통 prototypejs나 jquery 등을 사용한 뒤 class를 정의해서 쓰는 방법을 쓰거나 아니면 아예 javascript 고유의 문법으로 수행하지만 이 사람이 만든대로 몇가지 간단한 sugar function을 사용하면 더욱 간단한 문법으로 표현 가능하니 다른 라이브러리에 의존하지 않고 상속 구조를 구현하려면 이것도 괜찮겠다 싶다.

물론 다른 라이브러리를 쓰게 된다면 어차피 그 라이브러리에 유사한 기능이 있을테니 그걸 쓰면 되겠다.
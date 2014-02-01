---
layout: post
title: 빠른 메시지 만들기
tags: c++ message -pub
---

[Cap'n Proto](http://kentonv.github.io/capnproto/)와 같은 무한대(?)로 빠른 메시지를 설계한다고 생각해보자. 그렇다면 우리는 어떤 점을 고민해야 할까?

이를 위해 잠깐 네트워크로 정보를 전달하는 과정을 생각해보자.

1. end-point #1은 정보를 패킷에 담아 네트워크로 전송한다. (serialize)
2. end-point #2는 네트워크에서 바이트를 읽어 메시지를 구성하고, 그 메시지로부터 정보를 읽는다. (deserialize)

당연한 이야기지만 메시지 serialize/deserialize 비용을 최소화하는 것이 정답이란 소리다. 그러면 이것을 어떻게 최적화할 수 있을까? 이는 메시지에 어떠한 내용이 들어가냐를 고민해봄으로써 좀 더 자세히 생각해볼 수 있다.

다음과 같은 메시지가 있다고 해보자.

```cpp
struct player_message_t {
    float hp, mp;
    int atk, def, luck;
};
```

위 경우 serialize, deserialize 과정이 필요가 없다. 왜냐하면,

```cpp
// send
send(reinterpret_cast<const byte*>(&player_stat));

// receive
player_message_t* message = reinterpret_cast<const player_message_t*>(buffer);
```

c/c++의 struct는 바로 byte로 mapping될 수 있기 때문데 send할 때 그냥 보내고, receive할 때 그냥 casting해서 읽으면 되기 때문이다. 이 경우 필요한 추가 정보라고 해봐야 message dispatch를 위한 id와, message의 경계를 확인하기 위한 message size 정도이다.

```cpp
struct message_header_t {
    int message_id;
    int message_size;
};
```

하지만 위와 같은 단순한 경우일 때 message_size는 단순히 sizeof(T) 같은 형태로 얻어낼 수 있으니 더욱 구조가 간단해질 수 있다.

좀 더 복잡한 메시지를 고려해보자. 소위 말하는 가변 길이 메시지인데 보통은 list 때문에 발생한다. (string의 경우 char의 list)

이 경우 가장 간단한 방법은 size를 기록하는 것이다.

```cpp
struct player_message_t {
    float hp, mp;
    int name_size;
    char* name_bytes;
    int atk, def, luck; 
};
```

하지만 이 경우 첫 번째 경우와 같은 serialize/deserialize 성능을 보이기가 어렵다. 그 이유는 `name_bytes` 때문인데, 이 때문에 쓸 때 따로 write하는 구문을 추가해야할 뿐만 아니라 읽을 때도 `name_size`만큼 메모리를 할당한 다음 메시지를 읽도록 구현해야 하기 때문이다.

하지만 위 문제를 해결할 수 있는 간단한 방법이 있다. 바로 offset과 null-terminated를 사용하는 것이다.

```cpp
struct player_message_t {
    float hp, mp;
    int name_offset;
    int atk, def, luck;
    const char* name() const {
        return reinterpret_cast<const char*>(this) + name_offset;
    }
};
```

이 경우 메시지의 bytes 구조는 다음과 같아진다.

* `hp` `mp` `name_offset` `atk` `def` `luck` `name-bytes`

위와 같이 작성할 경우 serialize 입장에서는 큰 차이가 없다. hp, mp, atk, def, luck를 모두 write한 다음 `name_offset`의 위치를 기록하고, 마지막 부분에 `name-bytes`를 기록한다. 하지만 deserialize에서 큰 차이가 나타난다. 첫 번째 소개한대로 읽은 message buffer에 대해 단순히 `player_message_t`로 casting만 해서도 관련 정보를 모두 읽을 수 있는 구조이기 때문에, deserialize 비용이 필요 없어진다.

list도 위와 같은 방법으로 구현할 수 있다. 차이점이 있다면 string의 경우 char type에 대해 구현한 것이고, list의 경우 어떤 T type에 대해 구현한다는 것이다.

```cpp
struct player_message_t {
    float hp, mp;
    int name_offset;
    int inven_offset;
    int inven_count;
    int atk, def, luck;
    struct inven_t {
        int item_id;
        int item_data_id;
    };
    const char* name() const {
        return reinterpret_cast<const char*>(this) + name_offset;
    }
    const inven_t* begin() const {
        return reinterpret_cast<const inven_t*>(
                    reinterpret_cast<const char*>(this) + inven_offset);
    }
    const inven_t* end() const {
        return reinterpret_cast<const inven_t*>(
                    reinterpret_cast<const char*>(this) + inven_offset)
                        + inven_count;
    }
};
```

이 경우 메시지의 구조는 다음처럼 된다.

* `hp` `mp` `name_offset` `inven_offset` `inven_count` `atk` `def` `luck` `name-bytes` `inven_t-bytes`

그냥 string랑 똑같은데 `begin()`, `end()` method를 나누어 구현했다고 보면 된다. 다만, `end()` 함수에서 `inven_count`를 더하는 부분이 `inven_t` 크기가 고정일 경우를 가정하고 있는데, 이 부분은 null-terminated 등을 써서 가변에 대해서도 쉽게 적용할 수 있을 것이라 보기 때문에 더 이상의 자세한 설명은 생략한다. (iterator를 직접 구현하여 사용할 경우 간단히 해결할 수 있는데 그렇게까지 글을 쓰면 너무 무의미하게 길어진다.)

~~대체 왜 이런 글을 쓰는지 지금도 잘 모르겠지만 어쨌든 글을 마무리 짓자면,~~ 발상의 전환을 통해 어렵지 않은 방법으로 성능 개선을 할 수 있는 방법은 무궁무진하니 이미 알고 있는 내용일지라도 여러 방면으로 고민하여 기술을 갈고 닦았으면 좋겠다.

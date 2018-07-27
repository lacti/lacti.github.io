---
layout: post
title: 메시지 enum에 따른 message 콜백 함수 자동생성
tags: c++ message
---

일단 message에 대한 기본 type과 각 message을 구분하기 위한 enum이 있다.

```cpp
struct message_base_t {};

enum message_enum {
	message1,
	message2,
	message3,
	message_count,
};
```

message과 enum 값을 쉽게 연결하기 위해 중간 층을 도입한다.

```cpp
template <int code>
struct message_enum_t : public message_base_t {
	enum {
		enum_value = code
	};
};
```

이제 message을 만든다.

```cpp
struct message_struct_1 : public message_enum_t<message1> {};
struct message_struct_2 : public message_enum_t<message2> {};
struct message_struct_3 : public message_enum_t<message3> {};
```

기본적인 handler는 다음과 같이 단순하게 정의할 수 있다.

```cpp
typedef void (*base_handler_t)(const message_base_t&);
```

dispatch를 위해 handler에 대한 table을 하나 만들어둔다.

```cpp
typedef std::array<base_handler_t, message_count> handler_table_t;
static handler_table_t _handler_table_t;
```

일단 등록된 handler가 없어도 서버 동작에 문제가 없도록 하기 위해 빈 handler로 초기화를 해준다.

```cpp
static void empty_handler(const message_base_t&) {}
static struct handler_init_t {
	handler_init_t() {
		for (int index = 0; index < message_count; ++index)
			_handler_table_t[index] = empty_handler;
	}
} _init;
```

각 handler를 쉽게 등록하기 위한 register를 만든다.

```cpp
struct handler_register_t {
	handler_register_t(int index, base_handler_t handler) {
		_handler_table_t[index] = handler;
	}
};
```

handler의 귀찮은 함수 선언, casting, register 등록 부분의 코드를 생성해줄 macro를 정의한다.

```cpp
#define HANDLER(messageName) \
	static void handler_##messageName(const messageName& msg); \
	static void _base_##messageName##_handler(const message_base_t& msg) { \
		handler_##messageName(static_cast<const messageName&>(msg)); \
	} \
	static handler_register_t _register_##messageName( \
		messageName::enum_value, _base_##messageName##_handler); \
	static void handler_##messageName(const messageName& msg)
```

위 macro를 사용해서 handler를 구현한다.

```cpp
HANDLER(message_struct_1) {
	std::cout << typeid(msg).name() << std::endl;
}
```

dispatch를 구현한다.

```cpp
template <typename _msgTy>
inline void dispatch_message(const _msgTy& msg) {
	_handler_table_t[_msgTy::enum_value](msg);
}
```

모든 구현이 끝났으니 사용하면 된다.

```cpp
void main() {
	dispatch_message(message_struct_1());
	return 0;
}
```

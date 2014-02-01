---
layout: post
title: generic한 c++ rpc 구현
tags: c++ rpc -pub
---

generic한 rpc를 간단히 구현해보자.

원래 의도는 asio를 사용하여 가벼운 덧셈 rpc 정도를 구현해보자는 것이었는데 왠지 모르게 스터디 친구들이 spec을 안드로메다로 보내버려서 [DSEL](http://c2.com/cgi/wiki?EmbeddedDomainSpecificLanguage)을 통한 rpc stub, skeleton 생성 코드를 구현해보도록 하겠다.

양이 좀 많기 때문에 개요부터 설명하겠다.

* rpc 메시지을 주고 받기 위한 **buffer**를 먼저 설계하고, 메시지을 처리할 **handler**를 선언한다.
* 이를 기반으로 하나의 연결(connection)을 처리할 **session**을 구현하고, 이 위에 `rpc_server`와 `rpc_client`을 구현할 것이다.
* 마지막으로 구현된 기반 라이브러리를 바탕으로 **DSEL**을 만들어서 실제 사용할 rpc를 구현해볼 것이다.

### buffer ###

네트워크로 byte를 주고 받기 위한 buffer는 다음과 같이 쉽게 구현할 수 있다. 다만 매번 복사되는 것을 막기 위해 shared_ptr 형태도로 사용할 것이다.

```cpp
typedef std::vector<char> buffer_t;
typedef boost::shared_ptr<buffer_t> buffer_ref;
```

buffer로부터 데이터를 읽고 쓰는 class를 구현해보자. template만 있으면 primitive type에 대해서는 쉽게 구현할 수가 있다.

```cpp
class buffer_reader_t {
public:
    buffer_reader_t(const char* buffer)
        : _buffer(buffer) {}
    template <typename _Ty>
    friend buffer_reader_t& operator >> (buffer_reader_t& reader, _Ty& value) {
        value = *reinterpret_cast<const _Ty*>(reader._buffer);
        reader._buffer += sizeof(_Ty);
        return reader;
    }
private:
    const char* _buffer;
};

class buffer_writer_t {
public:
    buffer_writer_t()
        : _buffer(boost::make_shared<buffer_t>()) {}
    template <typename _Ty>
    friend buffer_writer_t& operator << (buffer_writer_t& writer, const _Ty& value) {
        const char* byte_begin = reinterpret_cast<const char*>(&value);
        const char* byte_end = byte_begin + sizeof(value);
        std::copy(byte_begin, byte_end, std::back_inserter(*writer._buffer.get()));
        return writer;
    }
    buffer_ref buffer() { return _buffer; }
private:
    buffer_ref _buffer;
};
```

`buffer_writer_t` 객체는 여기저기 복사되어 전달될 수 있다. 그 때마다 buffer가 복사되면 자원이 아까우니 `shared_ptr` 형태인 buffer_ref를 사용하도록 하였다.

### handler ###

`buffer_reader_t`와 `buffer_writer_t`가 정의되었으니 handler는 다음과 같이 정의할 수 있다.

```cpp
typedef boost::function<bool (buffer_reader_t, buffer_writer_t)> handler_t;
typedef std::array<handler_t, 128> handler_array_t;
```

rpc 함수는 필요한 인자(argument)를 buffer로부터 읽어서(`buffer_reader_t`) 그 결과를 다시 buffer로 써야한다(`buffer_writer_t`). 따라서 함수 signature가 reader와 writer를 인자로 받도록 구성된 것이다. 이 때 `buffer_writer_t` 객체가 reference가 아닌 이유는 writer가 갖고 있는 buffer 자체가 이미 `buffer_ref`이기 때문이다. 반환 값이 bool인 이유는 handler가 false를 반환할 경우 writer에 의해 작성된 buffer를 network로 전달하지 않기 위함이다.

`rpc_client_t`와 `rpc_server_t`는 각기 다른 `handler_array_t`를 갖는다. 이 때 가질 수 있는 handler는 128개로 제한하였다. (원래 `UINT16_MAX`를 썼는데 이만큼 쓸 경우 `rpc_server_t`나 `rpc_client_t` 객체를 local variable로 만들면 stackoverflow가 발생한다-_-)

### session ###

필요한 자료구조를 다 만들었으니 session도 쉽게 만들 수 있다. `session_t` class는 하나의 socket을 갖고, 그에 대해서 async-read/write 요청/완료 처리를 하는 class이다. peer로부터 message를 받으면 해당 message를 dispatch하여 적절한 handler를 호출해준다.

```cpp
class session_t : public boost::enable_shared_from_this<session_t> {
public:
    session_t(boost::asio::io_service& io_service, handler_array_t& handler_array);

    void request_connect(boost::asio::ip::tcp::endpoint endpoint);
    void request_read_msg_size();
    void request_read_msg();
    void request_write(buffer_ref buffer);

    bool is_connected() const { return _connected; }
    friend class rpc_server_t;
private:
    void handle_connect(const boost::system::error_code& error);
    void handle_read_msg_size(const boost::system::error_code& error);
    void handle_read_msg(const boost::system::error_code& error);
    void handle_write(const boost::system::error_code& error);

private:
    boost::asio::io_service& _io_service;
    boost::asio::ip::tcp::socket _socket;

    size_t _msg_size;
    buffer_t _msg_buffer;
    std::atomic_bool _connected;
    handler_array_t& _handler_array;
};
typedef boost::shared_ptr<session_t> session_ref;
```

[boost asio](http://www.boost.org/doc/libs/1_54_0/doc/html/boost_asio.html)에 대해 자세한 설명은 하지 않겠다. 어쨌든 중요한건 요청을 수행하는 request 함수와 완료를 처리하는 handle 함수가 분리되어있다는 것이다.

전체 코드를 다 올리면 너무 기니까 간단하게 message를 읽는 코드만 옮겨보았다.

```cpp
void session_t::request_read_msg_size() {
    boost::asio::async_read(_socket,
        boost::asio::buffer(&_msg_size, sizeof(_msg_size)),
        boost::asio::transfer_exactly(sizeof(_msg_size)),
        boost::bind(&session_t::handle_read_msg_size, shared_from_this(),
        boost::asio::placeholders::error));
}
void session_t::request_read_msg() {
    if (_msg_buffer.size() < _msg_size)
        _msg_buffer.resize(_msg_size);
    boost::asio::async_read(_socket,
        boost::asio::buffer(_msg_buffer.data(), _msg_size),
        boost::asio::transfer_exactly(_msg_size),
        boost::bind(&session_t::handle_read_msg, shared_from_this(),
        boost::asio::placeholders::error));
}
```

먼저 msg_size를 먼저 받아온 후 그 크기만큼 msg를 읽는다. `_msg_size` 변수는 `size_t` type인데 `asio::buffer()`는 type을 가리지 않기 때문에 `size_t` 변수에 바로 크기를 받아올 수 있다. 그 후 필요한 크기만큼 buffer를 적절하게 늘려서 `transfer_exactly`로 `async_read()`를 요청하면 boost asio가 알아서 잘 채워준다.

```cpp
void session_t::handle_read_msg_size(const boost::system::error_code& error) {
    if (!error) {
        request_read_msg();
    } else _connected = false;
}
void session_t::handle_read_msg(const boost::system::error_code& error) {
    if (!error) {
        buffer_reader_t reader(_msg_buffer.data());
        uint16_t msg_type;
        reader >> msg_type;

        handler_t handler = _handler_array[msg_type];
        if (handler != nullptr) {
            buffer_writer_t writer;
            if (handler(reader, writer))
                request_write(writer.buffer());
        }
        request_read_msg_size();
    } else _connected = false;
}
```

`msg_size` 요청 후 `msg_size`에 대한 완료 처리를 하고 그 다음에 msg 요청 후 msg에 대한 완료 처리를 한다. 그리고 다시 `msg_size` 요청하여 다음 msg를 받을 수 있도록 한다. 이렇게 하는 이유는 한 시점에 **반드시 하나의 msg만 읽는 순서가 보장**되도록 하기 위함이다.

어쨌든 msg를 읽었으면 `msg_type` 확인해서 `handler_array`에서 찾아 handler를 호출해준다. 그리고 원할 경후 handler에 의해 작성된 buffer_writer_t 내의 buffer를 peer에게 보내준다. (추후 코드가 나오겠지만 `handler_array`의 index 값과 message의 type 값은 일치하도록 구현하였다)

### rpc_server ###

`rpc_server_t` class는 boost asio acceptor를 사용하여 socket을 받고, `session_t` 객체를 만들어서 `request_msg_size()` 함수를 불러주는 class이다. protected로 노출되는 `handler_array`를 갖는데, 그 이유는 이를 상속받아 구현할 `rpc_server_t` class가 각 message를 받아 어떻게 처리할지 handler를 구현할 수 있도록 하기 위함이다.

```cpp
class rpc_server_t {
public:
    rpc_server_t(boost::asio::io_service& io_service, int server_port);
    virtual ~rpc_server_t() {}
    void request_accept();
    void handle_accept(session_ref session, const boost::system::error_code& error);
protected:
    handler_array_t _handler_array;
private:
    boost::asio::io_service& _io_service;
    boost::asio::ip::tcp::acceptor _acceptor;
};

void rpc_server_t::request_accept() {
    session_ref session = boost::make_shared<session_t>(_io_service, _handler_array);
    _acceptor.async_accept(session->_socket,
        boost::bind(&rpc_server_t::handle_accept, this, session,
            boost::asio::placeholders::error));
}
void rpc_server_t::handle_accept(session_ref session, const boost::system::error_code& error) {
    session->request_read_msg_size();
    request_accept();
}
```

역시 accept의 순서 보장을 위해서 하나 accept 요청하고, 그 완료를 처리 후에 다음 accept를 요청하도록 되어있다. 사실 처음에 동시 접속이 많을 경우 위 같은 방법은 별로 좋지 않을 수 있다. 이를 위해 프로그램 처음 구동 시 `request_accept()`를 미리 많이 불러놓는 경우도 있다.

`rpc_server` 측에 구현되는 message handler는 각 `message_type`에 따라 구현이 달라야 한다. 두 int의 덧셈을 요청하는 message라면 `int+int`을 구현해야 하고, 만약 두 double의 곱셈을 요청하는 message라면 `dobule*double`을 구현해야 하기 때문이다. 이 handler들은 추후 `rpc_server_t` class를 상속 받아 구현하는 rpc class에서 정의될 것이다.

### rpc_client ###

`rpc_client_t` class는 `rpc_server_t` class에 비해 다소 복잡하다.

* rpc 수행 결과를 비동기로 받아야 하니 rpc 요청 시 결과를 처리할 callback을 받아야 한다.
* 그리고 해당 rpc에 대한 수행 결과가 언제 올지 모르니, 요청할 때 id를 발급해서 id와 callback을 map같은 곳에다가 저장을 해두어야 한다.
* 그런데 rpc 함수의 return type은 제각각이니 이 callback을 일관된 type으로 통일을 해주어야 한다.

그렇기 때문에 코드가 좀 복잡해진다. 일단 전체 코드를 보면 다음과 같다.

```cpp
class rpc_client_t {
public:
    rpc_client_t(boost::asio::io_service& io_service);
    virtual ~rpc_client_t() {}
    void connect(const std::string& addr, unsigned short port);
protected:
    struct general_callback_t {
        virtual ~general_callback_t() {}
        virtual void operator () (buffer_reader_t) = 0;
    };
    typedef std::unique_ptr<general_callback_t> general_callback_ptr;
    typedef std::map<int, general_callback_ptr> callback_map_t;
    int register_callback(general_callback_ptr callback);
    general_callback_ptr get_callback(int req_num);
protected:
    session_ref _session;
private:
    void initialize_handlers();
    bool default_handler(buffer_reader_t reader, buffer_writer_t writer);
private:
    handler_array_t _handler_array;
    callback_map_t _callback_map;
    std::mutex _callback_map_mutex;
    static std::atomic_int _req_num_gen;
};
```

callback을 단일 type을 취급하기 위해 `general_callback_t` struct를 작성하였다. 단순히 `buffer_reader_t` 객체를 받아서 뭔가 처리하는 functor이고, 여기에 필요한 코드는 추후 rpc client 구현 시 macro로 찍어내게 될 것이다. 어쨌든 `general_callback_t`를 만들었으니 이 소유권을 보장해주기 위한 `unique_ptr`을 하나 선언하고, 이에 대한 map을 구성할 수 있다.

이제 `atomic_int`에 의해 thread-safe하게 증가되는 `request_number`와 함께 callback을 map에다가 register할 수 있는 것이다. 그리고 추후 해당 `request_number`에 대한 결과가 오면 `callback`을 꺼내서 호출해주면 된다.

`rpc_server_t` class와는 다르게 `rpc_client_t` class는 `handler_array`를 갖지만 `default_handler`로 모든 것을 처리한다.

```cpp
void rpc_client_t::initialize_handlers() {
    auto handler = boost::bind(&rpc_client_t::default_handler, this, _1, _2);
    for (auto& each : _handler_array)
        each = handler;
}
bool rpc_client_t::default_handler(buffer_reader_t reader, buffer_writer_t writer) {
    int req_num;
    reader >> req_num;
    general_callback_ptr callback = get_callback(req_num);
    if (callback != nullptr)
        (*callback)(reader);
    return false;
}
```

왜냐하면 `rpc_client` 입장에서는 도착하는 모든 message가 `request_number + result` 일 것인데, `request_number` 가져와서 `callback`을 얻었으면 실제 result를 얻는 것은 callback 내부에서 처리하기 때문에 handler에서는 따로 더 해줄 일이 없기 때문이다. (return false를 하는 이유는 rpc_client가 다시 rpc_server에게 뭔가 보낼 필요가 없기 때문이다)

callback 내에서는 reader 객체에서 result 값을 읽어서 사용자가 넘긴 진짜 callback을 불러줄 것이다. 그리고 이러한 코드는 macro에 의해서 자동 생성될 것이다.

### code generating ###

이제 기반 class 구현이 끝났으니 기반 class를 상속받아 우리가 원하는 rpc class를 작성하면 되겠다. 하지만 우리의 관심사는 **rpc 함수의 interface가 어떻게 선언되고, 그것에 대한 코드가 어떻게 정의되는가**이다. 나머지 byte serializer나 rpc type enum 선언 등의 [boilerplate code](http://en.wikipedia.org/wiki/Boilerplate_code)를 매번 작성해주는 것은 매우 귀찮은 일이니 직접하지 말고 컴파일러를 시키는 것이 여러모로 좋겠다.

일단 원하는 최종 형태의 코드는 다음과 같다.

```cpp
RPC_BEGIN(example)
    RPC_METHOD2(int, add, int, a, int, b)
    RPC_METHOD2(double, add, double, a, double, b)
    RPC_METHOD3(int, add, int, a, int, b, int, c)
RPC_END(example)

int example::add(int a, int b) { return a + b; }
double example::add(double a, double b) { return a + b; }
int example::add(int a, int b, int c) { return a + b + c; }
```

rpc interface에 대한 선언을 하고, 그에 대한 구현을 한다. 그러면 필요한 나머지 코드가 모두 만들어지는 것이다.

type_enum, server 측의 rpc 수행 함수의 prototype, rpc_server, rpc_client 총 4개의 코드를 찍어내야 한다. 여기에는 [X Macro pattern](http://en.wikipedia.org/wiki/X_Macro)이 사용될 것이다.

일단 본 예제에서는 총 3개의 인자까지 받을 수 있는 `RPC_METHOD3` macro까지 구현하였다. 결국 인자 개수만큼 macro를 다 만들어주어야 한다는 것인데 이러한 반복 코드는 [boost pp](http://www.boost.org/doc/libs/release/libs/preprocessor/doc/index.html)를 사용해서 줄일 수 있다. 그렇지만 이 글에서 해당 내용까지 다루면 너무 길어지므로 일단 그냥 중복된 코드를 포함한 채로 macro를 선언하였다.

설명의 편의를 위해 `RPC_METHOD2()`를 기준으로 설명할 것이다.

type enum이 필요한 이유는 rpc client와 server가 어떤 rpc를 요청했는지를 구분하기 위한 식별자로 사용하기 위함이다. 그냥 enum 내에 rpc 함수 이름을 열거하면 되는데, 동일한 이름의 다른 argument type의 rpc가 존재할 수 있으니 rpc 이름에 type을 붙여서 type enum을 구성하도록 하자.

type enum 이름은 앞으로도 자주 사용되므로 이를 위한 helper macro를 선언한다.

```cpp
#define RPC_TYPE2(name, type1, type2) type_##name##_##type1##_##type2
```

그리고 helper macro를 사용하여 enum을 생성하는 코드를 만들 수 있다.

```cpp
#define RPC_BEGIN(name) namespace name { enum type_enum {
#define RPC_METHOD2(rtype, name, type1, var1, type2, var2) RPC_TYPE2(name, type1, type2),
#define RPC_END(name) }; /* enum */ } /* namespace */
```

코드 생성의 편의를 위해 namespace 내에 코드를 만들도록 하였다.

rpc server 측의 코드를 생성할 때에는, 실제 구현할 rpc 함수에 대한 prototype 선언, 그리고 message를 통해 실제 rpc 함수를 불러주는 entry function 2개의 코드를 만들어주어야 한다.

prototype을 생성해주는 코드는 간단한 편이다.

```cpp
#define RPC_BEGIN(name) namespace name {
#define RPC_METHOD2(rtype, name, type1, var1, type2, var2) rtype name(type1 var1, type2 var2);
#define RPC_END(name) };
```

그냥 해당 namespace 안에 rpc 함수 이름을 갖고, 지정된 type의 인자를 받는 함수를 선언하였다.

rpc server class를 만들어주는 macro는 약간 복잡하다. 아까 만든 rpc_server_t class를 상속받는 class를 하나 만든 후, `handler_array`에 각 rpc message를 받아서 실제 rpc 함수를 불러주는 과정의 코드를 만든다.

```cpp
#define RPC_BEGIN(name) \
    namespace name { \
    class name##_rpc_server_t : public rpc_server_t { \
    public: \
        name##_rpc_server_t(boost::asio::io_service& io_service, int server_port) \
            : rpc_server_t(io_service, server_port) { \
            initialize_handlers(); \
        } \
    private: \
        void initialize_handlers() {
#define RPC_METHOD2(rtype, name, type1, var1, type2, var2) \
            _handler_array[RPC_TYPE2(name, type1, type2)] = [] \
                    (buffer_reader_t reader, buffer_writer_t writer) -> bool { \
                int req_num; \
                type1 var1; \
                type2 var2; \
                reader >> req_num >> var1 >> var2; \
                rtype result = name(var1, var2); \
                writer << sizeof(uint16_t) + sizeof(int) + sizeof(rtype); \
                writer << static_cast<uint16_t>(RPC_TYPE2(name, type1, type2)); \
                writer << req_num; \
                writer << result; \
                return true; \
            };
#define RPC_END(name) \
        } /* initialize_handlers */ \
    }; /* class */ \
    }  /* namespace */
```

그냥 `rpc_server_t` class 상속받고, `initialize_handlers()` 함수를 만든다. 그리고 그 함수 내에서 각 rpc message를 어떻게 처리할지에 대한 코드를 만드는데, 필요한 인자 정보를 `buffer_reader_t` 객체를 통해 읽고, 아까 prototype을 선언한 실제 함수를 불러 결과(result)를 얻은 뒤, 다시 그 결과를 `buffer_writer_t` 객체에 남아서 peer(client)에게 전달해주는 것이다.

rpc client 쪽은 callback 때문에 약간 복잡해보일 수 있지만 server와 난이도는 동일하다. 인자로 받은 내용을 buffer에 담아 peer(server)에게 보내고, 그 결과가 오면 callback을 불러주면 된다.

```cpp
#define RPC_BEGIN(name) \
    namespace name { \
    class name##_rpc_client_t : public rpc_client_t { \
    public: \
        name##_rpc_client_t(boost::asio::io_service& io_service) \
            : rpc_client_t(io_service) { \
        }
#define RPC_METHOD2(rtype, name, type1, var1, type2, var2) \
        void name(type1 var1, type2 var2, boost::function<void (rtype)> callback) { \
            buffer_writer_t writer; \
            writer << sizeof(uint16_t) + sizeof(int) + sizeof(type1) + sizeof(type2); \
            writer << static_cast<uint16_t>(RPC_TYPE2(name, type1, type2)); \
            struct __callback_t : public general_callback_t { \
                virtual void operator () (buffer_reader_t reader) { \
                    rtype result; \
                    reader >> result; \
                    _callback(result); \
                } \
                __callback_t(boost::function<void (rtype)> callback) \
                    : _callback(callback) {} \
                boost::function<void (rtype)> _callback; \
            }; \
            int req_num = register_callback(general_callback_ptr( \
                                new __callback_t(callback))); \
            writer << req_num << var1 << var2; \
            _session->request_write(writer.buffer()); \
        }
#define RPC_END(name)   \
    }; /* class */  \
    }  /* namespace */
```

`size`, `msg_type`, `req_num`, `args` 순으로 데이터를 writer에 써서 peer(server)에게 보낸다. 이 때 user-callback은 rtype(return type)을 인자로 받는 void function인데, 이를 callback map에 등록하기 위해 `general_callback_t` 객체로 감싼다. 이 `__callback_t` 객체의 `operator ()`가 불렸다는 것은 server의 수행 결과가 `buffer_reader_t` 객체에 담겼다는 것이므로 여기서 result를 읽어서` _callback`(user-callback)을 불러주기만 하면 된다.

이제 X-Macro pattern을 사용하기 위한 macro function 선언은 끝났다. 이제 약간의 전처리기 기술을 사용하면 코드가 완성된다. 개념을 익히기 위해 다음 코드르 보자.

```cpp
#ifdef _OPTION_
/* define macro functions */
#include _TARGET_
/* undef macro functions */
#endif
```

위 코드는 `_OPTION_` macro가 정의되어 있을 때만 수행되는 코드로, macro function을 그 구간 내에서만 사용하도록 정의(define) 후 해제(undef)하고 있다. 재밌는 것은 #include 부분인데 특정 파일을 지칭한 것이 아니라 `_TARGET_`라는 macro value를 지칭하고 있다. 즉, 위 내용이 들어있는 파일을 include하기 전에 `_TARGET_` macro에 적절한 파일명을 넣어주면 알아서 해당 파일을 include해준다는 것이다.

본 소스의 `rpc_gen_spec.h` 파일을 보면 `_RPC_GEN_TYPE_`,  `_RPC_GEN_SERVER_`, `_RPC_GEN_CLIENT_` 3개의 option에 대해서 각각 macro function을 교체한 후 `_RPC_GEN_TARGET_` macro value로 정의한 파일을 include하도록 되어있다.
이제 실제로 코드를 찍어내기 위한 `rpc_gen.h`에서는 다음과 같이 한 번에 여러 코드를 만들어낼 수 있다.

```cpp
#define _RPC_GENERATING_ 1
#   define _RPC_GEN_TYPE_
#     include "rpc_gen_spec.h"
#   undef _RPC_GEN_TYPE_

#   ifdef _RPC_SERVER_
#     define _RPC_GEN_SERVER_
#        include "rpc_gen_spec.h"
#       undef _RPC_GEN_SERVER_
#   endif

#   ifdef _RPC_CLIENT_
#      define _RPC_GEN_CLIENT_
#       include "rpc_gen_spec.h"
#     undef _RPC_GEN_CLIENT_
#   endif
#undef _RPC_GENERATING_
```

일단 `_RPC_GEN_TYPE_` macro를 선언하고 `rpc_gen_spec.h` 파일을 include해서 `type_enum` 코드를 먼저 만들어낸다.  그리고 `_RPC_SERVER_`라는 option이 있으면 다시 `_RPC_GEN_SERVER_` macro 선언 후 `rpc_gen_spec.h` 파일을 include해서 서버 측 코드를 만들어낸다. 같은 방법으로 `_RPC_CLIENT_` option이 있으면 클라이언트 코드도 만들어낸다.

위 코드가 수행되는 동안 `_RPC_GENERATING_` 이라는 macro를 선언하고 있는데 그 이유는 이 파일을 include하는 쪽에서 초기 값을 선언할지, 아니면 코드 template을 선언할지에 대한 phase를 결정하도록 하기 위함이다.

`example_rpc.h` 파일을 보면 이해하기가 쉽다.

```cpp
#ifndef _RPC_GENERATING_
#   define _RPC_SERVER_
#   define _RPC_CLIENT_
#   define _RPC_GEN_TARGET_ "example_rpc.h"
#   include "rpc_gen.h"
#else
RPC_BEGIN(example)
    RPC_METHOD2(int, add, int, a, int, b)
    RPC_METHOD2(double, add, double, a, double, b)
    RPC_METHOD3(int, add, int, a, int, b, int, c)
RPC_END(example)
#endif
```

`_RPC_GENERATING_` macro가 선언되어 있지 않다면 `_RPC_SERVER_`, `_RPC_CLIENT_` option을 주고, `_RPC_GEN_TARGET_`으로 이 파일 이름을 준다. 즉, 처음 이 파일이 include될 때 코드를 생성하기 위한 초기 값을 지정하는 것이다.

그리고 `rpc_gen.h` 파일이 include가 되면 `_RPC_GENERATING_` macro가 설정되고 `rpc_gen_spec.h` 파일이 include되면서 `_RPC_GEN_TARGET_`으로 지정된 `example_rpc.h` 파일이 **다시** include가 될 것이다. 이 때 `_RPC_GENERATING_` macro가 정의되었으므로 `RPC_BEGIN(...)` 코드가 사용될 것이고 이 macro function들이 적절히 치환되어 원하는 코드가 적절하게 생성될 것이다.

### example ##

이제 모든 작업이 끝났으니 다음과 같이 코드를 실행해볼 수 있다.

```cpp
#include "example_rpc.h"

int example::add(int a, int b) { return a + b; }
double example::add(double a, double b) { return a + b; }
int example::add(int a, int b, int c) { return a + b + c; }

int _tmain(int argc, _TCHAR* argv[]) {
    boost::asio::io_service io_service;
    example::example_rpc_server_t server(io_service, 12345);
    server.request_accept();

    example::example_rpc_client_t client(io_service);
    client.connect("127.0.0.1", 12345);
    
    client.add(10, 20, [] (int result) {
        std::cout << result << std::endl;
    });
    client.add(11.5, 23.7, [] (double result) {
        std::cout << result << std::endl;
    });
    client.add(10, 20, 30, [] (int result) {
        std::cout << result << std::endl;
    });
    io_service.run();
    return 0;
}
```

client 객체를 통해 rpc argument가 적절히 rpc server에게 전달되어 실 구현 함수가 수행된 후, 그 결과가 적절히 client의 callback으로 돌아와 console에 출력되는 것을 볼 수 있다.

### 정리 ###

* macro 코드가 좀 더러운데 이 부분은 boost pp로 정리하면 어느 정도 괜찮아진다.
* thread-safe하지 않은 코드가 좀 보이는데 적절하게 고쳐 쓰면 multi-thread에서도 안전하게 사용할 수 있다.
* handler 개수가 128개로 제한되는 것이 아까우면 handler_array가 heap에 할당되도록 수정하면 된다.
* rpc 결과를 callback으로 받아오는 것이 마음에 들지 않는다면 boost coroutine을 써서 실행 흐름을 제어하면 된다.

어쨌든 할만큼 한 것 같다. reflection이 익숙한 스터디 친구들은 저정도로 만족하지 못할 것 같지만 c++에서 code generator 도움이 없이 코드를 정리하면 저게 한계다. 정말이다!

### 소스 코드 ###

* [Github: cpp-rpc](https://github.com/lacti/cpp-rpc)
* 첨부된 프로젝트를 실행하기 위해서는 BOOST_INCLUDE, BOOST_LIB64 macro에 각 경로를 지정해야 한다. Visual Studio의 Property Manager window를 켜서, Microsoft.Cpp.x64.user를 열어 User Macros에 BOOST_INCLUDE와 BOOST_LIB64를 추가해주면 된다.
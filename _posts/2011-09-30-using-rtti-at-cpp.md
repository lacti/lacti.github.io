---
layout: post
title: c++ 에서 구조체 RTTI 정보 남기기
tags: c++ -pub
---

RTTI는 Run-time Type Information의 약자로, 실행 중에 어떤 type에 대한 정보를 알 수 있다는 것이다. 보통 type 에 대한 정보는 컴파일 타임에 다 사용되고, 실행 중에는 없어지는데, 실행 중에 이 정보를 얻을 수 있으면 재밌는 일을 많이 할 수 있다.

Java나 C#, 아니면 여타 동적 언어들은 당연히 이 기능을 지원하고 (보통 reflection 이라고 한다)
C, C++ 은 당연히 지원 안한다. 실행 중에 뭔가 정보를 더 남긴다는 것은 메모리도 많이 먹고 참조하려면 속도도 느려지니까!

그래서 구조체에 있는 정보만으로 xml read/write 가 자동으로 이루어지려면,
1. 타입 정보를 runtime 에 접근해서 동적으로 read/write 를 한다.
2. xml read/write 코드를 generator 를 통해 찍어낸다.

보통 성능을 위해 2번을 쓰지만 본 글에서는 1번 방법에 대해 서술하겠다.

### tstring ###

RTTI는 string을 통해 각 정보를 가져오는 것이므로 먼저 char, wchar로부터 자유로워야 한다.

```cpp
namespace std
{
    typedef wstring  tstring;
    typedef wostream tostream;
    typedef wistream tistream;
}
```

### field info ###

간단하게 type의 종류를 정의해보자. 여러 타입이 있겠지만 귀찮으니까 int, float만 정의하자.

```cpp
enum type_t { NONE, INT, FLOAT };
```

구조체의 각 변수 정보를 남기기 위해 그 정보를 저장할 자료를 선언하자.

```cpp
struct var_info
{
    var_info (const std::tstring& _name, const type_t& _type, size_t _offset)
        : name (_name), type (_type), offset (_offset) {}

    var_info (const var_info& o)
        : name (o.name), type (o.type), offset (o.offset) {}

    std::tstring name;
    type_t       type;
    size_t       offset;
};
typedef std::map<std::tstring, var_info> varmap_t;
```

구조체 내의 변수의 이름과 타입 정보를 갖는 것은 당연하다.  
그런데 offset이라는 정보도 필요하다. 왜냐하면 xml read 를 수행할 때 읽은 데이터를 객체의 **어느 공간** 에 넣어야 할 지 그 위치를 계산해서 넣어야 하기 때문이다. 따라서 메모리 상에 그 변수가 객체의 시작 지점으로부터 얼마만큼 떨어져서 위치하는가를 알고 있어야 한다.

### struct info ###

이제 구조체 정보를 저장해보자.

```cpp
struct struct_info
{
    struct_info (const std::tstring& _name) : name (_name) {}
    struct_info (const struct_info& o) : name (o.name) {}
    struct_info () {}

    std::tstring name;
    varmap_t varmap;
};
```

그냥 단순히 구조체에 대한 이름과 구조체에 대한 변수 목록을 map 객체로 갖고 있다.

### rtti ###

rtti라는 단순한 객체를 정의해보자. 단순히 이건 각 구조체 이름에 대응되는 `struct_info` 객체를 갖고 있으면 되니까 map 이면 충분하다.

```cpp
typedef std::map<std::tstring, struct_info> rtti_t;
rtti_t rtti;
```

### offset_of ###

구조체 내의 어떤 변수가 구조체 객체의 시작 주소로부터 얼마나 떨어져 있나를 계산하는 것은 간단하다.
시작 주소를 0으로 만든 뒤 그 변수의 주소를 가져오면 되기 때문이다. 따라서 다음과 같은 매크로를 만들 수 있다.

```cpp
#define OFFSET_OF(_struct, _var) ((size_t) &(((_struct *) NULL)->_var))
```

`NULL`을 구조체 주소로 casting해서 그 변수를 접근한다. 하지만 접근해서 값을 쓰는게 아니라 단순히 & 연산자로 주소 값만 얻으니까 access violation은 없다. 그리고 저 주소 값이 얼마만큼 떨어졌는지의 값(offset)이다.

### DSEL ###

이제 구조체를 정의하는 매크로를 만들어야 한다.
이게 약간 문제가 있는데, 본 문제를 출제한 [if1live]님의 요구 사항은 아래와 같다.

```cpp
STRUCT_BEGIN(SampleStruct)
    STRUCT_VAR_FLOAT(SampleStruct, a)
    STRUCT_VAR_INT(SampleStruct, b)
STRUCT_END()
```

보통 프로그램의 시작과 함께 초기화되는 정보를 구성할 경우에는 전역 변수를 많이 쓴다. 예를 들면,

```cpp
struct __temp {
    __temp () { printf ("hello world!"); }
} ___temp;
```

와 같이 `__temp`라는 struct를 정의해서 `___temp` 라는 전역 변수를 만든다. 전역 변수는 프로그램이 시작될 때 초기화되고, 이 때 생성자가 불리면서 hello world 가 출력될 것이다.

하지만 구조체 각 변수는 구조체의 { } scope 안에 존재하기 때문에 전역 변수를 사용할 수 없는 공간이다. 따라서 좀 다른 방법을 써야한다.


구조체 내의 멤버 변수들은 구조체 객체가 처음 생성될 때, 그 생성자가 호출된다. 예를 들면,

```cpp
struct Sample {
    struct __temp {
        __temp () { printf ("hello world"); }
    } ___temp;
};
```

위와 같이 `Sample` 구조체를 정의했다. 저 `Sample`의 변수를 하나라도 만드는 순간,
`Sample` 구조체 내의 변수들이 초기화된다. `___temp` 변수도 초기화된다. 따라서 `__temp`의 생성자가 호출된다. 따라서 `Sample` 구조체의 instance를 만들 때 마다 우리는 hello world를 볼 수 있을 것이다.

중복 실행을 막으려면 어떻게 해야할까? 간단히 static 변수를 하나 쓰면 된다.

```cpp
struct Sample {
    struct __temp {
        __temp () { 
            static bool once = true;
            if (once)
                printf ("hello world");
            once = false;
        }
    } ___temp;
};
```

그러면 hello world는 `Sample` 객체를 처음 만들 때는 나오겠지만 그 다음부터는 안 나올 것이다.
이 방법을 사용하여 각 변수들까지 RTTI에 등록할 것이다.

### register DSEL ###

먼저 한 번만 등록하기 위한 매크로를 만들어보자.

```cpp
#define REGISTER_ONLY_ONCE(_rtti, _name, _info) \
    static bool init = false; \
    if (!init) \
        _rtti.insert(std::make_pair(_T(#_name), _info)); \
    init = true;
```

이 코드는 구조체와 구조체의 변수를 각각 RTTI에 등록할 때 사용될 것이다.

이제 구조체를 등록하는 매크로와 변수를 등록하는 매크로를 보자.

```cpp
#define REGISTER_RTTI_STRUCT(_name) \
    REGISTER_ONLY_ONCE(rtti, _name, (struct_info (_T(#_name))))

#define REGISTER_RTTI_VAR(_struct, _var, _type) \
    REGISTER_ONLY_ONCE(rtti[_T(#_struct)].varmap, _var, (var_info (_T(#_var), _type, OFFSET_OF(_struct, _var))))
```

구조체를 등록하는 매크로는 전역 `rtti_map` 객체에 `struct_info`를 넣어준다.
구조체의 변수를 등록하는 매크로는 자신이 속한 구조체 rtti 내의 `varmap` 객체에 `var_info`를 넣어준다.

구조체의 변수를 등록하려면, 결국 자기가 어느 struct에 속한지를 알아야, 전역 rtti에서 자신이 속한 `struct_info`를 얻어와서 거기에 변수 정보(`var_info`)를 등록할 수 있다는 것이다. 이 때문에 [if1live]님의 매크로의 변수 선언부를 보면, `STRUCT_VAR_FLOAT(SampleStruct, a)`와 같이 구조체의 이름과 변수의 이름이 같이 들어가는 것이다.


### declaration DSEL ###

이제 기본 RTTI 등록 매크로가 완성되었으니, 구조체 선언 매크로와 구조체 변수 선언 매크로를 작성하면 된다.
구조체 선언 매크로는 다음과 같다.

```cpp
#define STRUCT_BEGIN(_name)    \
    struct _name \
    {    \
    private: \
        struct __register_init { __register_init () { REGISTER_RTTI_STRUCT(_name); } } ___register_init; \
    public: \
        static const std::tstring& name() { static std::tstring __name(_T(#_name)); return __name; }
```

지정된 이름으로 구조체를 시작한다.
멤버로 갖는 구조체의 생성자에서 RTTI 등록 매크로를 사용하여 구조체 정보를 등록하도록 한다.
이왕이면 private으로 만들어서 그 임시 변수는 접근을 못하게 하자.

나중에 xml read / write 를 할 때 구조체의 이름으로부터 RTTI 정보를 얻어와야 하므로 static 함수로 그 이름을 반환하도록 한다. 구조체의 이름으로 static string 변수를 하나 선언해놓고 그걸 반환해준다.

구조체 내 변수 선언 매크로는 다음과 같다.

```cpp
#define STRUCT_VAR(_struct, _var, _ctype, _type) \
    public: \
        _ctype _var; \
    private: \
        struct __register_##_var { __register_##_var () { REGISTER_RTTI_VAR(_struct, _var, _type); } } ___register_##_var; \
    public:
```

인자로 받은 c-type으로 public 변수를 선언하고, RTTI에 등록하기 위한 임시 멤버 변수로 RTTI 등록 매크로를 불러준다. 이제 저 기본 매크로를 이용하여 type 별 선언 매크로를 만든다.

```cpp
#define STRUCT_VAR_INT(_struct, _var)        STRUCT_VAR(_struct, _var, int, INT)
#define STRUCT_VAR_FLOAT(_struct, _var)        STRUCT_VAR(_struct, _var, float, FLOAT)
```

마지막으로 구조체 선언을 닫아주어야 하므로 마무리 매크로를 만든다.

```cpp
#define STRUCT_END()    };
```

그러면 제시한 대로 매크로를 통해 RTTI가 등록된 구조체를 선언할 수 있다.

```cpp
STRUCT_BEGIN(SampleStruct)
    STRUCT_VAR_FLOAT(SampleStruct, a)
    STRUCT_VAR_INT(SampleStruct, b)
STRUCT_END()
```

저 `SampleStruct` 구조체는 `a`: float, `b`: int 변수를 가질 것이고, 그 정보들은 이름 문자열과 함께 rtti 변수에 저장될 것이다.


### xml reader/writer ###

xml read / write를 구현해보자.
먼저, 저 Object를 받았을 때 `var_info`의 offset을 사용하여 어떻게 각 변수를 접근하나 보자.

offset 정보는 구조체의 시작 주소로부터 그 변수까지의 간격(거리)라고 했다.
그러면 그 변수에 접근하려면,

1. 구조체의 시작 주소를 구한다.
2. 시작 주소에 offset 을 더한다.
3. 그 주소를 변수의 pointer type 에 맞게 casting 한다.
4. 그 pointer 를 dereferencing 해서 값을 넣거나 뺀다.

여기서 주의해야 할 점은 구조체의 시작 주소를 구할 때, 그냥 & 연산자만 쓰는게 아니라 char * 으로 casting 을 해주어야 한다는 것이다. 왜냐하면 offset 이란건 시작 주소로부터 그 변수까지 떨어진 **바이트 수**인데,

Object 시작 주소를 & 연산자로 구해놓고 그 포인터에  + 연산을 수행하면 **그 주소는 Object 의 크기만큼 증가한다**. 따라서 바이트 단위로 증가시켜주기 위해 char * 로 casting 한다. (char * 와 int * 각각의 변수에 대해 + 연산자를 사용하면 증가하는 값이 다르다는 이야기인데, 다 알고 있겠지만 한 번 더 설명 해 봤다.)

그러면 아래와 같은 매크로를 만들 수 있다.

```cpp
#define GET_VAR_ADDR(_ctype, _obj, _offset) ((_ctype *) (((char*) &_obj) + _offset))
#define GET_VAR(_ctype, _obj, _offset) (*(GET_VAR_ADDR(_ctype, _obj, _offset)))
```

### xml writer ###

xml write를 먼저 만들어보자. `std::ostream`을 쓸 예정이다.
자주 입력해야하는 문자열은 미리 매크로로 만들어두자. 귀찮다.

```cpp
#define XML_START_TAG(name)      _T("<") << name << _T(">")
#define XML_END_TAG(name)        _T("</") << name << _T(">")
#define XML_TAB                  _T("\t")
```

그런데 `ostream`은 뭐가 들어올지 모른다. 기본적으로 `wostream`과 그냥 `ostream`부터가 다르다.
그러니까 template을 쓴다. 그러면 << 연산자만 overloading 되어있는 모든 대상에 대해 이 함수를 쓸 수 있다. (저걸 overloading하는 network 통신 용 객체가 있다면 네트워크로 바로 xml이 써질 것이다.)

그리고 xml로 작성해야할 대상 객체로부터도 general해야 하므로 그것도 template으로 정한다.

그래서 함수를 만들면 아래와 같다.

```cpp
template <typename _stream, typename _struct>
bool xml_write(_stream& out, const _struct& obj)
{
    if (rtti.find(obj.name()) == rtti.end())
        return false;

    const struct_info& si = rtti[_struct::name()];
    out << XML_START_TAG(si.name) << std::endl;
    for (varmap_t::const_iterator i = si.varmap.begin(); i != si.varmap.end(); ++i)
    {
        const var_info& vi = i->second;
        out << XML_TAB << XML_START_TAG(vi.name);
        switch (vi.type)
        {
        case INT: out << GET_VAR(int, obj, vi.offset); break;
        case FLOAT: out << GET_VAR(float, obj, vi.offset); break;
        }
        out << XML_END_TAG(vi.name) << std::endl;
    }
    out << XML_END_TAG(si.name) << std::endl;
    return true;
}
```

매우 간단하다. 멤버의 타입도 2개 밖에 없다고 한정지었고, 구조체 내의 구조체(nested struct)와 같은 구조도 전혀 고려하지 않았다.

단순히 정의된 구조체의 `name()`을 통해 구조체 이름을 얻어서 rtti에 접근해 구조체 정보를 얻는다.
거기서 각 멤버에 대한 정보를 순회하면서 그 값을 `GET_VAR`로 가져와 인자로 받은 stream 객체에 값을 쓴다.

### xml reader ###

xml read는 write에 비해 훨씬 복잡해야 하지만 제대로 된 xml parser를 작성할 생각은 추호도 없다.

먼저 배열의 개수를 얻는 매크로를 보자. 크기는 `sizeof`로 얻을 수 있으니 개수를 얻으려면 아래와 같겠다.

```cpp
#define COUNT_OF(array)        (sizeof (array) / sizeof (array[0]))
```

자, 이제 모든 준비가 끝났으니 xml read를 작성하자.
이번에도 역시 입력 스트림과 값을 읽을 객체에 대해 template 인자로 받는다.

```cpp
template <typename _stream, typename _struct>
bool xml_read(_stream& in, _struct& obj)
{
    if (rtti.find(obj.name()) == rtti.end())
        return false;

    const struct_info& si = rtti[_struct::name()];
    
    TCHAR name[1024], value[1024];
    in.ignore(1024, _T('>')); // ignore root node
    for (varmap_t::const_iterator iter = si.varmap.begin(); iter != si.varmap.end(); ++iter)
    {
        in.ignore(1024, _T('<')); // ignore before start tag
        in.getline(name, COUNT_OF(name), _T('>'));
        in.getline(value, COUNT_OF (value), _T('<'));

        const var_info& vi = si.varmap.find(std::tstring(name))->second;
        switch (vi.type)
        {
        case INT: GET_VAR(int, obj, vi.offset) = _wtoi (value); break;
        case FLOAT: GET_VAR(float, obj, vi.offset) = static_cast<float> (_wtof (value)); break;
        }
    }
    return true;
}
```

구조체의 이름으로 rtti 정보를 가져온다.
xml에 어떤 순서로 기록될지는 모르지만, 어쨌든 구조체 내 멤버만큼은 node가 있겠지, 라고 가정했다.
따라서 구조체 내 멤버 정보로 iteration을 수행하는데, 사실 그냥 개수만 세기 위한 훼이크다!

istream의 `ignore` 기능을 활용하여 쓸데 없는 whitespace 등을 무시하고, `getline` 함수의 delim을 적절히 활용하여 각 node의 이름과 값을 얻어서, 그 멤버 변수의 type에 따라 `GET_VAR`를 통해 그 값을 넣어준다.


그럼 아래와 같이 쓸 수 있다.

```cpp
int _tmain(int argc, _TCHAR* argv[]) {
    SampleStruct s;
    s.a = 1.0f;
    s.b = 2;
    xml_write(std::wcout, s);

    std::wifstream in(_T("test.xml"));
    if (in)
        xml_read(in, s);
    
    xml_write(std::wcout, s);
```

문제는 구조체를 한 번도 만들지 않았다면 RTTI 정보도 없다는 것이다 -_-;

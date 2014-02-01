---
layout: post
title: pintos 환경 구축
tags: os -pub
---

Pintos를 구동시키기 위해서는 먼저 가상 에뮬레이터가 필요하다. Open source 중에 대표적으로 Bochs와 QEMU가 있는데, 설치법이 과제 문서에 기술되어있는 Bochs를 선택하여 설치하였다.

* Bochs는 Open Source 프로젝트로 Sourceforge에서 그 소스를 다운받아 컴파일하여 설치할 수 있다. 파일을 받기 위해서 Sourceforge에 lynx로 접속하여 bochs-2.3.tar.gz를 다운 받았다.
* tar.gz 압축이므로 tar xvzf를 이용하여 압축을 풀었다.

```bash
~$ tar xvzf bochs-2.3.tar.gz
```

원격으로 터미널을 통해 진행할 예정이기 때문에 bochs가 terminal이 가능하고 gui가 없어도 동작할 수 있도록 컴파일해서 설치해야 했다. 따라서 configure 옵션에 `--with-term`과 `--with-nogui`를 주었다. 또 과제 문서에서 제시한 바와 같이 gdb debugging을 위해 `--enable-gdb-stub`을 옵션으로 주었다.

```bash
~/bochs-2.3$ ./configure --with-term --with-nogui --enable-gdb-stub
```

그 다음에 bochs를 make하고 설치하기 위해 make와 make install 명령을 수행했다. make install은 모든 사용자가 사용하는 전역 위치에 bochs를 설치하기 때문에 일반 사용자 권한으로는 설치가 안된다. 따라서 과제 문서가 제시한 대로 root 권한으로 설치를 수행하였다.

```bash
~/bochs-2.3$ make; sudo make install
```

bochs의 설치가 완료 되었다. 정상 동작을 확인하기 위해 `bochs --help`를 수행하였다.

```bash
~/bochs-2.3$ bochs --help
========================================================================
                        Bochs x86 Emulator 2.3
              Build from CVS snapshot on August 27, 2006
========================================================================
Usage: bochs [flags] [bochsrc options]

  -n               no configuration file
  -f configfile    specify configuration file
  -q               quick start (skip configuration interface)
  --help           display this help and exit

For information on Bochs configuration file arguments, see the
bochsrc section in the user documentation or the man page of bochsrc.
00000000000i[CTRL ] quit_sim called with exit code 0
```

다음으로 pintos를 실행하기 위해 pintos를 다운로드 받았다. pintos는 구글 검색을 통해 다운로드 주소가 [http://www.stanford.edu/class/cs140/projects/pintos/pintos.tar.gz](http://www.stanford.edu/class/cs140/projects/pintos/pintos.tar.gz)에 있음을 찾아내서 wget 명령으로 다운로드 받았다.

```bash
$ wget http://www.stanford.edu/class/cs140/projects/pintos/pintos.tar.gz
```

역시 tar.gz 압축이므로 tar xvzf로 압축을 해제하였다.

```bash
$ tar xvzf pintos.tar.gz
```

과제 문서에 제시된 대로 pintos/src/threads로 이동하여 make를 수행하였다.

```bash
$ cd pintos/src/threads
~/pintos/src/threads$ make
```

make 수행이 `undefined references to '__stack_chk_fail' follow`이라는 에러에 의해 중단되었다. 이를 해결하기 위해 구글을 검색하여 [다음의 레퍼런스](http://ubuntuforums.org/showthread.php?t=303541)를 얻었다. 이 포럼에서 권고하는 대로 make 설정에서 CFLAGS의 값에 `-fno-stack-protector` 옵션을 추가해주기 위해 편집기 vi를 사용하여 Make.vars에 `CFLAGS += -fno-stack-protector`를 추가해 주었다.

```bash
~/pintos/src/threads$ vi Make.vars
```

기존에 컴파일한 것들을 제거하기 위해 make clean을 수행한 후 make를 수행하여 빌드를 마쳤다.

```bash
~/pintos/src/threads$ make clean
~/pintos/src/threads$ make
```

Pintos를 수행하기 전에 편의를 위해서 다음과 같은 alias를 작성하였다. 이 alias를 ~/.bashrc에 추가하여 bash이 열릴 때마다 alias가 자동으로 등록되도록 했다. 그리고 어디에서나 pintos가 실행될 수 있도록 pintos 실행 파일이 있는 곳을 PATH에 추가하였다.

```bash
~/pintos/src/threads$ vi ~/.bashrc
```

추가한 내용은 아래와 같다.

```bash
export PATH=$PATH:~/pintos/src/utils/

alias pinv='pintos -v -- run'
alias pint='pintos -t -- run'

alias pinvg='pintos --gdb -v -- run'
alias pintg='pintos --gdb -t -- run'
```

추가한 내용을 적용시키기 위해서 source를 수행했다. 수행한 후, PATH가 적용되었는지 확인하기 위해서 설정된 PATH를 출력하도록 했다. 다음과 같이 추가된 것을 확인할 수 있었다.

```bash
~/pintos/src/threads$ source ~/.bashrc
~/pintos/src/threads$ echo $PATH
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/home/lacti/pintos/src/utils
```

pintos를 수행하기 위해 threads의 build 디렉토리로 이동하였다. 미리 작성해둔 alias를 이용하여 간단하게 pintos threads를 구동하였다.

```bash
~/pintos/src/threads/build$ pinv alarm-multiple
Writing command line to /tmp/w6Pkbt7Upa.dsk...
warning: can't find squish-pty, so terminal input will fail
bochs –q
```

위의 alias에 정의되어 있듯이 `pinv alarm-multiple`을 수행했을 경우 실제 수행되는 명령어는 `pintos –v –- run alarm-multiple`이다.

결과는 제대로 나오지만 warning이 꺼림직했기 때문에 `squish-pty`를 빌드하기로 하였다. `~/pintos/src/utils`로 이동하여 make를 수행하였다.

```bash
~/pintos/src/threads/build$ cd ../../utils/
~/pintos/src/utils$ make
```

`squish-pty`를 비롯한 몇 개의 파일들이 빌드되었고, 정상 작동함을 확인하기 위해 다시 pintos를 구동시켜보았다.

```bash
~/pintos/src/utils$ cd ../threads/build
~/pintos/src/threads/build$ pinv alarm-multiple
Writing command line to /tmp/UcIb0NhSWJ.dsk...
squish-pty bochs -q
========================================================================
                        Bochs x86 Emulator 2.3
              Build from CVS snapshot on August 27, 2006
========================================================================
00000000000i[     ] reading configuration from bochsrc.txt
00000000000i[     ] installing nogui module as the Bochs GUI
00000000000i[     ] using log file bochsout.txt
Kernel command line: run alarm-multiple
Pintos booting with 4,096 kB RAM...
375 pages available in kernel pool.
374 pages available in user pool.
Calibrating timer...  204,600 loops/s.
Boot complete.
Executing 'alarm-multiple':
(alarm-multiple) begin
(alarm-multiple) Creating 5 threads to sleep 7 times each.
(alarm-multiple) Thread 0 sleeps 10 ticks each time,
(alarm-multiple) thread 1 sleeps 20 ticks each time, and so on.
(alarm-multiple) If successful, product of iteration count and
(alarm-multiple) sleep duration will appear in nondescending order.
(alarm-multiple) thread 0: duration=10, iteration=1, product=10
(alarm-multiple) thread 0: duration=10, iteration=2, product=20
(alarm-multiple) thread 1: duration=20, iteration=1, product=20
(alarm-multiple) thread 0: duration=10, iteration=3, product=30
(alarm-multiple) thread 2: duration=30, iteration=1, product=30
(alarm-multiple) thread 0: duration=10, iteration=4, product=40
(alarm-multiple) thread 1: duration=20, iteration=2, product=40
(alarm-multiple) thread 3: duration=40, iteration=1, product=40
(alarm-multiple) thread 0: duration=10, iteration=5, product=50
(alarm-multiple) thread 4: duration=50, iteration=1, product=50
(alarm-multiple) thread 2: duration=30, iteration=2, product=60
(alarm-multiple) thread 0: duration=10, iteration=6, product=60
(alarm-multiple) thread 1: duration=20, iteration=3, product=60
(alarm-multiple) thread 0: duration=10, iteration=7, product=70
(alarm-multiple) thread 3: duration=40, iteration=2, product=80
(alarm-multiple) thread 1: duration=20, iteration=4, product=80
(alarm-multiple) thread 2: duration=30, iteration=3, product=90
(alarm-multiple) thread 4: duration=50, iteration=2, product=100
(alarm-multiple) thread 1: duration=20, iteration=5, product=100
(alarm-multiple) thread 1: duration=20, iteration=6, product=120
(alarm-multiple) thread 2: duration=30, iteration=4, product=120
(alarm-multiple) thread 3: duration=40, iteration=3, product=120
(alarm-multiple) thread 1: duration=20, iteration=7, product=140
(alarm-multiple) thread 4: duration=50, iteration=3, product=150
(alarm-multiple) thread 2: duration=30, iteration=5, product=150
(alarm-multiple) thread 3: duration=40, iteration=4, product=160
(alarm-multiple) thread 2: duration=30, iteration=6, product=180
(alarm-multiple) thread 4: duration=50, iteration=4, product=200
(alarm-multiple) thread 3: duration=40, iteration=5, product=200
(alarm-multiple) thread 2: duration=30, iteration=7, product=210
(alarm-multiple) thread 3: duration=40, iteration=6, product=240
(alarm-multiple) thread 4: duration=50, iteration=5, product=250
(alarm-multiple) thread 3: duration=40, iteration=7, product=280
(alarm-multiple) thread 4: duration=50, iteration=6, product=300
(alarm-multiple) thread 4: duration=50, iteration=7, product=350
(alarm-multiple) end
Execution of 'alarm-multiple' complete.
```

위와 같이 정상 작동함을 확인할 수 있었다. 종료를 위해 Ctrl + C를 누르면 다음과 같이 interrupt를 받으며 종료된다.

```bash
========================================================================
Bochs is exiting with the following message:
[     ] SIGNAL 2 caught
========================================================================
```

`pintos –t` 옵션을 사용하지 않고 `pintos –v` 옵션을 사용한 이유는 `pintos –t` 옵션을 사용하여 pintos를 구동시키게 되면 수행 후에 Ctrl + C로 interrupt를 걸어도 bochs가 수행을 종료하지 않고 메모리에 계속 남아있기 때문이다. 따라서 추가적으로 `kill -9` 등을 사용하여 종료해주어야 하므로 좀 더 편리한 `pintos –v` 옵션을 사용하였다. 물론 `pintos –t` 옵션을 사용하면 잠깐 지나가는 BIOS 화면을 볼 수 있다.

```bash
$ ps -ef |grep bochs
lacti    11939     1 99 02:19 pts/0    00:01:01 bochs -q
lacti    11941  3985  0 02:20 pts/0    00:00:00 grep bochs
```

다음 과정인 gdb를 수행하기 위해 gdb를 설치하였다.

```bash
~$ sudo apt-get install gdb
```

PuTTY를 하나 더 켜서 pintos를 gdb모드로 실행시켰다. 글자를 조금이라도 적게 치기 위해서 이미 위에서 alias를 정의해 놓았다. v 옵션으로 gdb를 수행하므로 pinvg이다. 따라서 과제 문서에서 제시한 대로 alarm-multiple를 수행하려면 `pinvg alarm-multiple`이라고 하면 되고, 실제 명령은 `pintos –-gdb –v – run alarm-multiple`이다.

```bash
~$ cd pintos/src/threads/build/
~/pintos/src/threads/build$ pinvg alarm-multiple
```

그러면 다음과 같이 bochs가 gdb의 접속을 기다리며 수행을 멈춘다.

```bash
~/pintos/src/threads/build$ pinvg alarm-multiple
Writing command line to /tmp/RArahIMk8f.dsk...
squish-pty bochs -q
========================================================================
                        Bochs x86 Emulator 2.3
              Build from CVS snapshot on August 27, 2006
========================================================================
00000000000i[     ] reading configuration from bochsrc.txt
00000000000i[     ] Enabled gdbstub
00000000000i[     ] installing nogui module as the Bochs GUI
00000000000i[     ] using log file bochsout.txt
Waiting for gdb connection on localhost:1234
```

다른 PuTTY에서 gdb를 켜서 원격 디버깅을 시작한다. 어차피 localhost이므로 `remote localhost:1234`로 연결하면 된다. 그러면 다음과 같이 접속이 이루어진다.

```bash
~$ gdb
GNU gdb 6.6-debian
Copyright (C) 2006 Free Software Foundation, Inc.
GDB is free software, covered by the GNU General Public License, and you are
welcome to change it and/or distribute copies of it under certain conditions.
Type "show copying" to see the conditions.
There is absolutely no warranty for GDB.  Type "show warranty" for details.
This GDB was configured as "i486-linux-gnu".
(gdb) target remote localhost:1234
Remote debugging using localhost:1234
warning: unrecognized item "ENN" in "qSupported" response
0x0000fff0 in ?? ()
(gdb)
```

여기서 `continue` 명령인 `c`를 누르면 pintos가 계속 진행된다. Ctrl + C를 눌러서 수행을 중단할 수 있다. 그리고 `kill` 명령을 이용하여 debugging을 중단하고 pintos의 수행을 중단할 수 있다. gdb에서 작업을 끝내려면 `quit` 명령을 이용해서 나가면 된다.

다음과 같이 `kill` 명령으로 수행 중인 pintos를 종료할 수 있다.

```bash
(gdb) c
Continuing.

Program received signal 0, Signal 0.
0xc0101660 in ?? ()
(gdb) kill
Kill the program being debugged? (y or n) y
(gdb)
```

그러면 pintos에서는 다음과 같이 Debugger의 종료 요청에 의한 종료를 수행하게 된다.

```bash
Execution of 'alarm-multiple' complete.
========================================================================
Bochs is exiting with the following message:
[     ] Debugger asked us to quit

========================================================================
```

// VisionCalc 启动器：把选型计算器页面内嵌进 exe，双击即用
// 编译: csc /target:winexe /out:VisionCalc.exe /win32icon:app\icon.ico /res:index.html,VisionCalc.index.html app\Program.cs
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

class VisionCalcLauncher
{
    [STAThread]
    static void Main()
    {
        try
        {
            // 1. 解出内嵌的 index.html 到本地数据目录
            string dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "VisionCalc");
            Directory.CreateDirectory(dir);
            string htmlPath = Path.Combine(dir, "index.html");

            Assembly asm = Assembly.GetExecutingAssembly();
            using (Stream src = asm.GetManifestResourceStream("VisionCalc.index.html"))
            using (FileStream dst = new FileStream(htmlPath, FileMode.Create, FileAccess.Write))
            {
                src.CopyTo(dst);
            }

            // 2. 用默认浏览器打开（无窗口后台运行，浏览器即界面）
            Process.Start(new ProcessStartInfo(htmlPath) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            // 兜底：出错时给出可见提示，避免双击没反应
            try
            {
                string msg = "VisionCalc 启动失败：" + ex.Message +
                    "\n\n备选方案：直接用浏览器打开软件目录里的 index.html";
                System.Windows.Forms.MessageBox.Show(msg, "VisionCalc",
                    System.Windows.Forms.MessageBoxButtons.OK,
                    System.Windows.Forms.MessageBoxIcon.Error);
            }
            catch { Console.Error.WriteLine(ex); }
        }
    }
}
